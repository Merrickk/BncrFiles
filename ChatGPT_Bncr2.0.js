/**
 * @author Merrick
 * @name ChatGPT_BNCR2.0
 * @origin Merrick
 * @version 1.0.2
 * @description ChatGpt聊天，适配无界2.0
 * @rule ^(ai) ([\s\S]+)$
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

todo（其实是我想做不会做，大佬带我~~~~~）
1.用更优雅的方式实现HumanTG的编辑回复和直接回复的切换
2.选择预设角色的时候可以把Prompt直接显示出来，方便调整（下拉列表框和文本框联动）
3.添加画图功能（大佬的代码已经实现了，我没有4.0的ApiKey，无法测试）
*/

const fs = require('fs');
const path = require('path');
const got = require('got');
const promptFilePath = './mod/prompts.json';
const fullPath = path.join(__dirname, promptFilePath);
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
const modeNames = ['GPT-3.5', 'GPT-3.5-16K', 'GPT-4', 'GPT-4-联网', 'GPT-4-DALLE', 'GPT-4-32K'];
const modeNums = [0, 1, 2, 3, 4, 5]
// 插件界面
const BCS = BncrCreateSchema;
const jsonSchema = BCS.object({
    apiBaseUrl: BCS.string().setTitle('ApiBaseUrl').setDescription('必填项').setDefault(''),
    apiKey: BCS.string().setTitle('ApiKey').setDescription('必填项').setDefault(''),
    isEdit: BCS.boolean().setTitle('HumanTG是否开启编辑模式').setDescription('关闭则逐条回复，不编辑消息').setDefault(false),
    promptSel: BCS.number().setTitle('选择预设角色',).setDescription('请根据需要选择').setEnum(promptNums).setEnumNames(promptNames).setDefault(0),
    modeSel: BCS.number().setTitle('选择GPT模型',).setDescription('请根据需要选择').setEnum(modeNums).setEnumNames(modeNames).setDefault(0),
    promptDiy: BCS.string().setTitle('请输入自定义Prompt').setDescription('输入自定义Prompt会使预设角色失效').setDefault('')
});
const ConfigDB = new BncrPluginConfig(jsonSchema);

module.exports = async s => {
    await ConfigDB.get();
    const CDB = ConfigDB.userConfig;
    if (!Object.keys(CDB).length) return await s.reply('请先到WEB界面完成插件首次配置');
    /* 补全依赖 */
    await sysMethod.testModule(['chatgpt'], { install: true });
    const modeNames = ['gpt-3.5-turbo', 'gpt-3.5-turbo-16k', 'gpt-4', 'gpt-4-browsing', 'gpt-4-dalle', 'gpt-4-32k'];
    if (!CDB.apiBaseUrl) return s.reply("未配置ApiBaseUrl");
    if (!CDB.apiKey) return s.reply("未配置ApiKey");
    const apiKey = CDB.apiKey;
    const apiBaseUrl = CDB.apiBaseUrl;
    const isEdit = CDB.isEdit;
    const promptDiy = CDB.promptDiy;
    let gptAPI = initializeChatGPTAPI(apiKey, apiBaseUrl, modeNames[CDB.modeSel]);
    if (s.param(1) === 'ai') {
        let prompt = '';
        if (!promptDiy) {
            prompt = prompts[CDB.promptSel].prompt;
        } else {
            prompt = promptDiy;
        }
        let history = [{
            role: 'system', content:  prompt + '，另外，输出字符限制，输出50-100字'
        }]
        await relpyMod(s, isEdit, `Let me see...`);
        history.push({ role: 'user', content: s.param(2) });
        let response
        try {
            let response = await fetchOpenAICompletions(gptAPI, history);
            history.push({
                role: 'assistant', content: response
            });
            await relpyMod(s, isEdit, response);
            await continuousDialogue(gptAPI);
        }
        catch (error) {
            handleError(error);
            //如果错误信息包含OpenAI error 429，使用gpt3.5模型继续调用
            if (error.toString().indexOf('OpenAI error 429') !== -1) {
                await relpyMod(s, isEdit, "gpt4模型调用失败，正在使用gpt3.5模型");
                try {
                    gptAPI = initializeChatGPTAPI(apiKey, apiBaseUrl, 'gpt-3.5-turbo');
                    let response = await fetchOpenAICompletions(gptAPI, history);
                    history.push({ role: 'assistant', content: response });
                    await relpyMod(s, isEdit, response);
                    await continuousDialogue(gptAPI);
                }
                catch (error) {
                    handleError(error);
                    return;
                }
            }
            return;
        }

        async function continuousDialogue(gptAPI) {
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
                history.push({
                    role: 'user', content: input
                });
                let response;
                try {
                    response = await fetchOpenAICompletions(gptAPI, history);
                    if (response) {
                        history.push({ role: 'assistant', content: response });
                        await relpyMod(s, isEdit, response);
                    } else {
                        throw new Error('continuousDialogue error');
                    }
                } catch (error) {
                    handleError(error);
                    return;
                }
            }
        }
    }

    async function relpyMod(s, isEdit, text) {
        const userId = s.getUserId();
        const groupId = s.getGroupId();
        const platform = s.getFrom();
        if (isEdit) {
            await s.reply(text);
        } else {
            if (groupId && groupId!=0) {
                sysMethod.push({
                    platform: platform,
                    groupId: groupId,
                    msg: text,
                    type: 'text',
                });
            } else {
                sysMethod.push({
                    platform: platform,
                    userId: userId,
                    msg: text,
                    type: 'text',
                });
            }
        }
        
    }

    function initializeChatGPTAPI(apiKey, baseUrl, model) {
        return {
            apiKey: apiKey,
            apiBaseUrl: baseUrl,
            completionParams: {
                model: model
            }
        };
    }

    async function fetchOpenAICompletions(gptAPI, messages, timeout = 30000) {
        const fetchPromise = got.post(`${gptAPI.apiBaseUrl}/chat/completions`, {
            json: {
                model: gptAPI.completionParams.model,
                messages: messages,
                stream: false
            },
            responseType: 'json',
            timeout: timeout,
            headers: {
                'Authorization': `Bearer ${gptAPI.apiKey}`
            }
        });

        try {
            const response = await fetchPromise;

            if (response.statusCode !== 200) {
                throw new Error(`HTTP error! status: ${response.statusCode}`);
            }
            const res = response.body.choices[0].message.content;
            return res;
        } catch (error) {
            console.error(`Fetch error: ${error.message}`);
            console.error(`Error stack: ${error.stack}`);
            if (error.response) {
                console.error(`Response status: ${error.response.statusCode}`);
                console.error(`Response data: ${JSON.stringify(error.response.body, null, 2)}`);
            }
            return null;
        }
    }

    function handleError(error) {
        console.log(error);
        let errorMessage = error.message || error.toString();
        errorMessage = unicodeToChinese(errorMessage);
        relpyMod(s, isEdit, "发生错误: " + errorMessage);
    }

    function isUnicode(str) {
        // 正则表达式检查字符串是否包含Unicode转义序列
        return /\\u[\dA-F]{4}/i.test(str);
    }

    function unicodeToChinese(text) {
        // 将Unicode转义序列转换为普通字符串
        if (isUnicode(text)) {
            return text.replace(/\\u([\dA-F]{4})/gi, function (match, grp) {
                return String.fromCharCode(parseInt(grp, 16));
            });
        } else {
            return text;
        }
    }
};

