const initApp = require('./src/lib/app');

initApp({
    /**
     * 过滤条件，根据标题来筛选目的邮件，比如以下会筛选标题带有better-fe的邮件
     */
    filter: 'better-fe',
    /**
     * 收集周刊的人员列表，用于展示哪些同学还没发周刊
     */
    users: [],
    /**
     * imap 配置
     */
    imap: {
        host: 'mail.xxx.com',
        port: 993,
        tls: true,
        ssl: false
    },
    /**
     * smtp 配置
     */
    smtp: {
        port: 587,
        host: "mail.xxx.com",
        tls: true
    },
    /**
     * 收件邮箱
     */
    sendTo: '',
    /**
     * 抄送邮箱
     */
    sendCC: '',
    /**
     * 从邮件中提取有用的信息出来
     * @param headers 邮件头部
     * @param data 邮件内容
     * @returns {null|{recommend, userName: (string|*), category, title, url}}
     */
    format: (headers, data) => {
        const userNameReg = /([\u4e00-\u9fa5]*)-([\u4e00-\u9fa5]*)\s(<[^>]*>)/;
        const userName = headers.get('from').text.replace(userNameReg, '$1');

        const contentReg = /##([^#]*)[\s\S]+\[([^\\]*)\]\(([^\)]*)\)([\s\S]+)/;
        const content = data.html.replace(/<[^>]*>|/g, "")
            .replace(/\s/g, '___better-fe___')
            .replace(/&nbsp;/ig, '')
            .replace(/___better-fe___/g, '')
            .match(contentReg);

        if (content && content.length) {
            const [, category, title, url, recommend] = content;
            return {userName, category, title, url, recommend}
        }

        return null
    }
});
