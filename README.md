# Bncr_plugins
## 微信客服对接简明教程

1.访问微信客服网址并开通 https://kf.weixin.qq.com/  
2.在“客服账号”创建一个客服账号  
3.在“开发配置”修改回调配置，回调URL填“无界地址/api/bot/wxWorkKF”，Token和EncodingAESKey随机生成，先不要点“完成”  
4.在无界安装依赖@wecom/crypto xml2js form-data express-xml-bodyparser，重启无界  
5.进入无界的WEB配置页面，启用适配器并填入corpId（企业ID）corpSecret（Secret）和encodingAESKey，保存。  
6.回到第3步的页面，点击完成，如提示成功则对接完成。  
7.在“开始接入”点击“在微信内其他场景接入”可以看到客服账号的链接，微信里点击这个链接就可以开启对话
  
注意：1.要启用管理员功能请在已有管理员权限的平台输入set wxWorkKF admin 用户ID,给客服发送消息的时候在控制台可以看到用户ID    
     2.微信客服独立版和原来的企业微信客服不能共存，已经开通的需要去原来的企业微信把微信客服停用  
     3.有反馈说新开通的账号第5步的时候找不到corpSecret（Secret），要等第6步完成后才能出来，大家自测  
     4.第6步无法顺利完成的话可以在点击时候打开无界控制台看有没有收到请求，能收到请求可能是因为无界响应太慢（需要1秒以内），请自行优化  
