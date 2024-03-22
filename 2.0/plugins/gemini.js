/**
 * @author Merrick
 * @name gemini
 * @origin Merrick
 * @version 1.0.0
 * @description gemini聊天
 * @rule ^gem ([\s\S]+)$
 * @rule ^识图$
 * @admin true
 * @public false
 * @priority 9999
 * @disable false
 */

/*
插件代码来自GitHub的某位大佬，本人仅修复bug和适配2.0界面

使用方法：将获取到的apiKey填入配置界面（获取方法请自行搜索），如后台提示"User location is not supported for the API use"，请尝试调整梯子
*/


const jsonSchema = BncrCreateSchema.object({
    apiKey: BncrCreateSchema.string().setTitle('apiKey').setDescription('请输入apiKey').setDefault("")
});
const ConfigDB = new BncrPluginConfig(jsonSchema);

module.exports = async s => {
    const got = require('got');
    const fs = require('fs');
    const { randomUUID } = require("crypto");
    const path = require('path');
    const { GoogleGenerativeAI } = require("@google/generative-ai");
    await ConfigDB.get();
    if (!Object.keys(ConfigDB.userConfig).length) {
        return await s.reply('请先发送"修改无界配置",或者前往前端web"插件配置"来完成插件首次配置');
    }
    const apiKey = ConfigDB.userConfig.apiKey; 
    // Access your API key as an environment variable (see "Set up your API key" above)
    const genAI = new GoogleGenerativeAI(apiKey);

    async function text() {
        // For text-only input, use the gemini-pro model
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const chat = model.startChat({
            history: [
                {
                    role: "user",
                    parts: [{ text: "你好，今天怎么样" }],
                },
                {
                    role: "model",
                    parts: [{ text: "Great to meet you. What would you like to know?" }],
                },
            ],
            generationConfig: {
                maxOutputTokens: 100,
            },
        })
        const result = await chat.sendMessage(msg);
        const response = await result.response;
        const text = response.text();
        console.log(text);
        s.reply(text);
        while (true) { // 进入持续对话模式
            let input = await s.waitInput(() => { }, 60);
            if (!input) {
                s.reply("对话超时。");
                break;
            };
            input = input.getMsg();
            if (input.toLowerCase() === 'q') { // 用户可以通过输入 'exit' 来退出对话
                s.reply("对话结束。");
                break;
            }
            // 发送请求到 ChatGPT API，并包含历史记录
            let result = await chat.sendMessage(input);
            const response = await result.response;
            const text = response.text();
            console.log(text);
            s.reply(text);
        }
    }
    function fileToGenerativePart(path, mimeType) {
    return {
        inlineData: {
            data: Buffer.from(fs.readFileSync(path)).toString("base64"),
            mimeType
        },
    };
}
    async function imageAI(){
        s.reply(`请发送一张图片`)
        let a = await s.waitInput(() => { }, 60);
        if (!a) {
            s.reply("超时。");
            return;
        };
        a = a.getMsg();
        let regex = /http/g;

        // 使用match()函数检查字符串是否包含匹配的URL
        let matchedUrls = a.match(regex);
        // 如果字符串包含匹配的URL，保存图片并发送
        if (matchedUrls) {
            //通过got获取图片并保存到本地
            const { body } = await got.get(a, { responseType: 'buffer' });
            const imgpath = path.join("/bncr/BncrData/public/", randomUUID()+'.jpg')
            console.log(imgpath)
            fs.writeFile(imgpath, body, (err) => {
                if (err) {
                    console.error('写入文件时出错:', err);
                    return;
                }
            });
            await sleep(1000)
            const model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });

            const prompt = "你看到了什么?";
          
            const imageParts = [
                fileToGenerativePart(imgpath, "image/jpeg"),
            ];
            const result = await model.generateContent([prompt, ...imageParts]);
            const response = await result.response;
            const text = response.text();
            console.log(text);
            s.reply(text)
            fs.unlinkSync(imgpath)

        } else {
            s.reply(`无法识别图片`)
        }
    }

    function fileToGenerativePart(path, mimeType) {
        return {
            inlineData: {
                data: Buffer.from(fs.readFileSync(path)).toString("base64"),
                mimeType
            },
        };
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    const msg = s.param(1);
    if (msg) {
        text();
    } else {
        await imageAI();
    }
}
