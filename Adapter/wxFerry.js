/**
 * @author Merrick
 * @name wxFerry
 * @origin Merrick
 * @team Merrick
 * @version 1.0.0
 * @description wechatFerry适配器
 * @adapter true
 * @public true
 * @disable false
 * @priority 2
 * @Copyright ©2024 Merrick. All rights reserved
 * @classification ["适配器"]
 */

/* 
v1.0.0 本适配器基于三藏大佬的wechatFerry适配器修改，大佬的订阅地址 https://github.com/3zang/Bncr_plugins
       主要基于Windows下的wechatFerry适配（项目地址：https://github.com/lich0821/wcf-client-rust），并增加了如下功能：
       1.消息体添加用户名
       2.收到好友请求通知管理员（原作者删除了自动通过好友的接口，暂时曲线一下）
       3.邀请进群（支持多个群）
v1.0.1 1.修复了好友请求通知管理员开关无效的bug
       2.新增设置添加好友后的欢迎词功能
*/

// Web界面配置
const BCS = BncrCreateSchema;
const jsonSchema = BCS.object({
    enable: BCS.boolean().setTitle('是否开启适配器').setDescription(`设置为关则不加载该适配器`).setDefault(false),
    wxFerryUrl: BCS.string().setTitle('上报地址').setDescription(`wechatFerry部署的地址`).setDefault(''),
    addFriend: BCS.boolean().setTitle('好友请求通知管理员').setDescription('设置为关则不开启收到好友请求通知管理员功能').setDefault(true),
    fileServer: BCS.string().setTitle('文件服务器地址').setDescription(`文件服务器部署的地址`).setDefault(''),
    // addFriend: BncrCreateSchema.boolean().setTitle('自动同意添加好友请求').setDescription(`设置为关则不开启自动同意好友请求`).setDefault(false),
    // addFriendCode: BncrCreateSchema.string().setTitle('自动同意好友暗号').setDescription(`设置为空则同意所有好友请求`).setDefault(''),
    addFriendWelcome: BCS.string().setTitle('添加好友后的欢迎词').setDescription('留空则不回复').setDefault(''),
    inviteStr: BCS.string().setTitle('邀请进群配置参数').setDescription('请按“邀请暗号&邀请群号&进群方式&备注”的样式填写邀请进群参数，进群方式“0”为拉人进群，“1”为邀请进群,多个群用“|”分隔').setDefault(''),
});
const ConfigDB = new BncrPluginConfig(jsonSchema);

module.exports = async () => {
    // Web参数配置判断
    await ConfigDB.get();
    if (!Object.keys(ConfigDB.userConfig).length) return sysMethod.startOutLogs('未启用wechatFerry适配器,退出')
    if (!ConfigDB.userConfig.enable) return sysMethod.startOutLogs('未启用wechatFerry 退出.');
    let wxFerryUrl = ConfigDB.userConfig.wxFerryUrl;
    if (!wxFerryUrl) return console.log('wechatFerry：未设置上报地址');
    wxFerryUrl += wxFerryUrl.endsWith('/') ? '' : '/';
    let fileServer = ConfigDB.userConfig.fileServer;
    if (fileServer) fileServer += fileServer.endsWith('/') ? '' : '/';
    const inviteStr = ConfigDB.userConfig.inviteStr;
    const addFriend = ConfigDB.userConfig.addFriend;
    const addFriendWelcome = ConfigDB.userConfig.addFriendWelcome;
    // 创建适配器
    const wxFerry = new Adapter('wxFerry');
    new BncrDB('wxFerry');
    const got = require('got');
    const xml2js = require('xml2js');
    // 获取好友列表
    let contacts = [];
    await getContacts();
    // 读取进群信息
    let inviteArray = [];
    if (inviteStr && inviteStr !== '') {
        tmpArray = inviteStr.split('|');
        for (const invite of tmpArray) {
            const inviteInfo = invite.split('&');
            if (inviteInfo.length === 4) {
                inviteArray.push({
                    inviteCode: inviteInfo[0],
                    groupId: inviteInfo[1],
                    inviteType: inviteInfo[2],
                    remark: inviteInfo[3]
                });
            }
        }
    }
    // 添加路由
    router.get('/api/bot/wxferry', (req, res) => res.send({ msg: '这是wxFerry Api接口，你的get请求测试正常~，请用post交互数据' }));
    router.post('/api/bot/wxferry', async (req, res) => {
        try {
            const body = req.body;
            // console.log('body', body);
            // 收到好友请求通知管理员
            if (body.type === 37 && addFriend) {
                let code = null;
                const xmlParser = new xml2js.Parser();
                xmlParser.parseString(body.content, (err, result) => {
                    if (err) {
                        throw new Error('添加好友信息解析失败');
                    } else {
                        code = result.msg.$.content;
                    }
                });
                await sysMethod.pushAdmin({
                    platform: ['wxFerry'],
                    msg: `收到微信好友添加请求，请求信息：${code}`
                });
            }
            // 添加好友后刷新好友列表
            if (body.type === 10000) {
                await getContacts();
                if (addFriendWelcome !== '') {
                    let welcomeStr = addFriendWelcome.replace(/\n/g, '\r');
                    await requestFerry({
                        receiver: body.sender,
                        aters: '',
                        msg: welcomeStr,
                        api: 'text',
                        msgId: '',
                    })
                }
            }
            // 自动同意加好友 预留备用
            // if (body.type === 37) {
            //     let v3 = null,
            //         v4 = null,
            //         scene = null,
            //         code = null;
            //     const xmlParser = new xml2js.Parser();
            //     xmlParser.parseString(body.content, (err, result) => {
            //         if (err) {
            //             throw new Error('添加好友信息解析失败');
            //         } else {
            //             v3 = result.msg.$.encryptusername;
            //             v4 = result.msg.$.ticket;
            //             scene = +result.msg.$.scene;
            //             code = result.msg.$.content;
            //         }
            //     });
            //     console.log(v3, v4, scene);
            //     if (v3 && v4 && scene) {
            //         await got.post(wxFerryUrl + 'accept-new-friend', {
            //             json: {
            //                 v3: v3,
            //                 v4: v4,
            //                 scene: scene,
            //             }
            //         });
            //     }
            // }
            let msgInfo = null;
            const contact = contacts.find(contact => contact.wxid === body.sender);
            const userName = contact ? contact.name : '';
            //私聊
            if (body.is_group == false) {
                msgInfo = {
                    userId: body.sender || '',
                    userName: userName,
                    groupId: '0',
                    groupName: '',
                    msg: body.content || '',
                    msgId: body.id || '',
                    fromType: `Social`,
                };
                //群
            } else if (body.is_group == true) {
                msgInfo = {
                    userId: body.sender || '',
                    userName: userName,
                    groupId: body.roomid.replace('@chatroom', '') || '0',
                    groupName: body.content.group_name || '',
                    msg: body.content || '',
                    msgId: body.id || '',
                    fromType: `Social`,
                };
            }
            // 处理邀请进群消息
            const inviteMatch = inviteArray.find(invite => invite.inviteCode === msgInfo.msg);
            if (inviteMatch) {
                const { inviteCode, groupId, inviteType, remark } = inviteMatch;
                if (inviteType === '0') {
                    await got.post(wxFerryUrl + 'add-chatroom-member', {
                        json: {
                            roomid: groupId + '@chatroom',
                            wxids: msgInfo.userId,
                        }
                    });
                } else {
                    await got.post(wxFerryUrl + 'invite-chatroom-member', {
                        json: {
                            roomid: groupId + '@chatroom',
                            wxids: msgInfo.userId,
                        }
                    });
                }
            }
            // 将消息发送到适配器
            msgInfo && wxFerry.receive(msgInfo);
            res.send({ status: 200, data: '', msg: 'ok' });
        } catch (e) {
            console.error('wxFerry接收消息出错:', e);
            res.send({ status: 400, data: '', msg: e.toString() });
        }
    });

    wxFerry.reply = async function (replyInfo) {
        // console.log('replyInfo', replyInfo);
        let body = null;
        const to_Wxid = +replyInfo.groupId ? replyInfo.groupId + '@chatroom' : replyInfo.userId;
        switch (replyInfo.type) {
            case 'text':
                replyInfo.msg = replyInfo.msg.replace(/\n/g, '\r');
                body = {
                    receiver: to_Wxid,
                    aters: "",
                    msg: replyInfo.msg,
                    api: 'text',
                    msgId: replyInfo.msgId,
                };
                break;
            case 'image':
                body = {
                    receiver: to_Wxid,
                    path: fileServer ? await getLocalPath(replyInfo.path, "image") : replyInfo.path,
                    api: 'image',
                    msgId: replyInfo.msgId,
                };
                break;
            case 'video':
                body = {
                    receiver: to_Wxid,
                    path: fileServer ? await getLocalPath(replyInfo.path, "video") : replyInfo.path,
                    api: 'file',
                    msgId: replyInfo.msgId,
                };
                break;
            default:
                return;
        }
        body && (await requestFerry(body));
        return '';
    };

    /* 推送消息方法 */
    wxFerry.push = async function (replyInfo) {
        return this.reply(replyInfo);
    };

    // /* 撤回消息方法 */
    // wxFerry.delMsg = async function (msgId) {
    //     try {
    //         await got.post(wxFerryUrl + 'revoke-msg?id=' + msgId);
    //     } catch (e) {
    //         console.error('wxFerry撤回消息出错', e);
    //     }
    // }

    // 发送请求
    async function requestFerry(body) {
        try {
            const resp = await got.post(wxFerryUrl + body.api, {
                json: body,
            });
            console.log('wxFerry回复消息:', resp.body);
            return resp.body;
        } catch (e) {
            console.error('wxFerry发送请求出错', e);
        }
    }
    // 获取文件路径
    /* 获取windows文件路径 */
    async function getLocalPath(url, type) {
        let req = { file_url: url, file_type: type };
        console.log("开始下载:", type, "文件:", url);
        const resp = await got.post(`${fileServer}download`, { 
            json: req,
            responseType: 'json'
        });
        return resp.body.file_path;
    }
    // 获取好友列表
    async function getContacts() {
        try {
            const resp = await got.get(wxFerryUrl + 'contacts', { responseType: 'json' });
            if (resp && resp.body.data) {
                contacts = resp.body.data.contacts;
            }
        } catch (e) {
            console.error('获取好友列表出错', e);
        }
    }

    return wxFerry;
}
