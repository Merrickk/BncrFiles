/**
 * @author Merrick
 * @name ChatGPT_BNCR2.0
 * @origin Merrick
 * @version 1.0.2
 * @description ChatGpt聊天，适配无界2.0
 * @rule ^(ai|画图) ([\s\S]+)$
 * @rule ^(ai)$
 * @admin true
 * @public false
 * @priority 99999
 * @disable false
 */

/* 
基于sumuen大佬的插件修改，主要是适配了2.0界面，按自己的使用习惯进行了一些调整，原插件在这里https://github.com/sumuen/Bncr_plugin/blob/main/Bncr_ChatGPT.js
需要ApiKey，没有的可以看看这个项目https://github.com/aurora-develop/aurora

v1.0.1 修复了QQ和微信平台在编辑模式下不能正常回复的bug
v1.0.2 跟进大佬修改了调用chatgpt模块，用got发送请求（虽然我不懂但是我会复制粘贴）
v1.0.3 因为前期搭建的项目有问题，调试的时候找不到原因，干脆把代码重新梳理了一遍，具体改动如下：
       1. 修改api的调用方式，采用ChatGPT API官方文档里的方式调用，去除了原作者大量的错误处理代码，大幅度精简了代码
       2. 添加画图功能，设定需要单独配置画图的各项参数，方便用户的不同需求
       3. 修改HumanTG的编辑回复功能，可以支持各种回复类型（前提是适配器支持）
       注意：这个版本最主要是加入了画图功能，如果不需要画图也可以不更新，因为新的调用方式我没有深入测试，不确定比原作者的got方式更好，更新的话需要同步更新prompts.json文件

todo（其实是我想做不会做，大佬带我~~~~~）
1.用更优雅的方式实现HumanTG的编辑回复和直接回复的切换
2.选择预设角色的时候可以把Prompt直接显示出来，方便调整（下拉列表框和文本框联动）
3.添加画图功能（大佬的代码已经实现了，我没有4.0的ApiKey，无法测试）✔
*/

const fs = require('fs');
const path = require('path');
const promptFilePath = './mod/prompts.json';
const fullPath = path.join(__dirname, promptFilePath);
const got = require('got');
// 读取prompts
let prompts = []
try {
    prompts = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
} catch (error) {
    handleError(error);
}
// 生成prompts选项
let promptNums = [],
    promptNames = [];
for (let i=0; i<prompts.length; i++ ) {
    promptNums.push(i);
    promptNames.push(prompts[i].act);
}
// 定义模型选项
const modes = ['gpt-3.5-turbo', 'gpt-3.5-turbo-16k', 'gpt-4', 'gpt-4-browsing', 'gpt-4-dalle', 'gpt-4-32k'];
// 插件界面
const BCS = BncrCreateSchema;
const jsonSchema = BCS.object({
    apiBaseUrl: BCS.string().setTitle('ApiBaseUrl').setDescription('必填项，一般为"域名/v1"').setDefault(''),
    apiKey: BCS.string().setTitle('ApiKey').setDescription('必填项').setDefault(''),
    isEdit: BCS.boolean().setTitle('HumanTG是否开启编辑模式').setDescription('关闭则逐条回复，不编辑消息').setDefault(false),
    promptSel: BCS.number().setTitle('选择预设角色').setDescription('请根据需要选择').setEnum(promptNums).setEnumNames(promptNames).setDefault(0),
    modeSel: BCS.string().setTitle('选择GPT模型').setDescription('请根据需要选择').setEnum(modes).setDefault('gpt-3.5-turbo'),
    promptDiy: BCS.string().setTitle('请输入自定义Prompt').setDescription('输入自定义Prompt会使预设角色失效').setDefault(''),
    imgBaseUrl: BCS.string().setTitle('画图的ApiBaseUrl').setDescription('启用画图功能必填，一般为"域名/v1"').setDefault(''),
    imgMode: BCS.string().setTitle('画图的模型').setDescription('启用画图功能必填，根据自己的API支持情况填写').setDefault(''),
    imgApiKey: BCS.string().setTitle('画图的ApiKey').setDescription('启用画图功能必填，根据自己的API支持情况填写').setDefault(''),
});
const ConfigDB = new BncrPluginConfig(jsonSchema);

module.exports = async s => {
    await ConfigDB.get();
    const CDB = ConfigDB.userConfig;
    if (!Object.keys(CDB).length) return await s.reply('请先到WEB界面完成插件首次配置');
    /* 补全依赖 */
    await sysMethod.testModule(['chatgpt'], { install: true });
    await sysMethod.testModule(['got'], { install: true });
    if (!CDB.apiBaseUrl) return s.reply("未配置ApiBaseUrl");
    if (!CDB.apiKey) return s.reply("未配置ApiKey");
    const apiKey = CDB.apiKey;
    const apiBaseUrl = CDB.apiBaseUrl;
    const isEdit = CDB.isEdit;
    const promptDiy = CDB.promptDiy;
    const imgBaseUrl = CDB.imgBaseUrl;
    const imgMode = CDB.imgMode;
    const imgApiKey = CDB.imgApiKey;


    const { ChatGPTAPI } = await import('chatgpt');
    let gptAPI = new ChatGPTAPI({
        apiKey: apiKey,
        apiBaseUrl: apiBaseUrl,
        completionParams: { model: CDB.modeSel},
        debug: false
    });

    if (s.param(1) === 'ai') {
        let prompt = '';
        if (!promptDiy) {
            prompt = prompts[CDB.promptSel].prompt;
        } else {
            prompt = promptDiy;
        }
        const promptMessage = `${prompt}，另外，输出字符限制，输出50-100字。`
        await relpyMod(s, isEdit, `正在思考中，请稍后...`);
        let fistChat = '你好';
        if (s.param(2)) fistChat = s.param(2)
        let response = await gptAPI.sendMessage(fistChat, {
            systemMessage: promptMessage,
            timeoutMs: 3 * 10 * 1000
        });
        await relpyMod(s, isEdit, response.text);
        while (true) {
            let input = await s.waitInput(() => { }, 60);
            if (!input) {
                await relpyMod(s, isEdit, "对话超时。");
                break;
            }
            input = input.getMsg();
            if (input.toLowerCase() === 'q') {
                await relpyMod(s, isEdit, "对话结束。");
                break;
            }
            if (input == '') continue;
            try {
                response = await gptAPI.sendMessage(input, {
                    parentMessageId: response.id
                });
                await relpyMod(s, isEdit, response.text);
            } catch (error) {
                console.log(error);
                return;
            }
        }
    } else if (s.param(1) === '画图') {
        if (!imgBaseUrl) return await relpyMod(s, isEdit, "未配置画图ApiBaseUrl");
        if (!imgApiKey) return await relpyMod(s, isEdit, "未配置画图ApiKey");
        if (!imgMode) return await relpyMod(s, isEdit, "未配置画图模型");
        await relpyMod(s, isEdit, '正在生成图像，请稍后');
        try {
            const response = await got.post( imgBaseUrl + '/images/generations', {
                json: {
                    model: imgMode,
                    prompt: `画一幅图，${s.param(2)}`
                },
                headers: {
                    'Authorization': `Bearer ${imgApiKey}`
                }
            });
            let data = JSON.parse(response.body).data;
            let dataUrl = data[0].url;
            await relpyMod(s, isEdit, {type:'image', path:dataUrl});
        } catch (error) {
            await relpyMod(s, isEdit, '画图出现异常，请去控制台查看错误提示');
            console.log(error);
            return;
        }
    }

    async function relpyMod(s, isEdit, replyVar) {
        const userId = s.getUserId();
        const groupId = s.getGroupId();
        const platform = s.getFrom();
        let replyObj = {};
        if (typeof replyVar === 'string') {
            replyObj = {type:'text', msg: replyVar}
        } else if (typeof replyVar === 'object') {
            replyObj = replyVar;
        }
        if (isEdit) {
            await s.reply(replyObj);
        } else {
            replyObj['platform'] = platform
            if (groupId && groupId!=0) {
                replyObj['groupId'] = groupId
                sysMethod.push(replyObj);
                
            } else {
                replyObj['userId'] = userId
                sysMethod.push(replyObj);
            }
        }
    }
}    