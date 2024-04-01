/**
 * @author Merrick
 * @name 千寻微信辅助
 * @origin Merrick
 * @version 1.0.0
 * @rule ^(收到千寻好友添加请求|拉我进群)$
 * @description 自动同意好友请求，自动拉群
 * @platform wxQianxun
 * @priority 99999
 * @admin false
 * @disable false
 */
 
/**     
    本插件源码来自【薛定谔的大灰机】https://github.com/BigPlanes/Bncr_plugins
    
    使用说明：
        本插件需要修改适配器，请去 https://github.com/Merrickk/Bncr_plugins/tree/main/Adapter 下载配套的适配器
        开启后可以自动同意好友申请，可以设置加好友暗号和欢迎语，发送【拉我进群】可以自动拉群

 */

const BCS = BncrCreateSchema
const jsonSchema = BCS.object({
    Agree: BCS.boolean().setTitle('同意好友申请开关').setDescription('开启则自动同意').setDefault(false),
    Mode: BCS.number().setTitle('邀请进群模式',).setDescription('请选择模式').setEnum([1,2]).setEnumNames(['直接拉群','发送邀请']).setDefault(1),
    Agree_keyword: BCS.string().setTitle('加好友暗号').setDescription('空则全部同意').setDefault(''),
    AutoReply_keyword: BCS.string().setTitle('自动回复词').setDescription('空则不回复').setDefault(''),
    GroupId: BCS.string().setTitle('群ID').setDescription('输入需要拉的群ID，空则不开启此功能').setDefault(''),
});

const ConfigDB = new BncrPluginConfig(jsonSchema);

module.exports = async s => {
    await ConfigDB.get();
    const CDB = ConfigDB.userConfig
    if (!Object.keys(CDB).length) {
        return await s.reply('请先发送"修改无界配置"来完成插件首次配置');
    }
    
    if (s.getMsg() !== '收到千寻好友添加请求') {
        Group()
    } else {
        Friend()
    }
    
    async function Group() {
        if (CDB.GroupId == '') {
            return s.reply('未设置群ID')
        } else {
            await s.reply({
                type: 'group',
                msg: '邀请入群',
                add_type: CDB.Mode,
                wxid: CDB.GroupId + '@chatroom',
                objWxid: s.getUserId()
            })
        }
    }

    async function Friend() {
        const body = s.Bridge.body.data.data
        if (body && s.getUserId() == 'EventFriendVerify') {
            console.log(`收到【${body.nick}】的好友申请`)
            await main()
        } else {
            console.log('非真实好友申请，忽略')
        }

        async function main() {
            if (CDB.Agree) {
                await AgreeFriendVerify();
                if (!!CDB.AutoReply_keyword) {
                    await AutoReply();
                }
            }
        }

        async function AgreeFriendVerify() {
            if (CDB.Agree_keyword) {
                if (CDB.Agree_keyword !== body.content) {
                    return console.log('暗号错误');
                }
            }
            await s.reply({
                type: 'friend',
                msg: '同意好友申请',
                v3: body.v3,
                v4: body.v4
            })
            console.log('已同意好友申请');
        }

        async function AutoReply() {
            if (CDB.AutoReply_keyword) {
                await s.reply({
                    type: 'text',
                    userId: body.wxid,
                    msg: CDB.AutoReply_keyword,
                })
            }
        }
    }
}