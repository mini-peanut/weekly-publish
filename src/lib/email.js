const Imap = require('imap');
const MailParser = require("mailparser").MailParser;
const async = require('async');
const sendEmail = require("emailjs");
const moment = require('moment/moment');
const partial = require('lodash/partial');
const LOGIN_FAIL_CODE = 3;

exports.fetchEmails = ({user, password, socket, imap: imapConfig, filter, format}) => {
    /**
     * 抓取6天以前的
     * @type {string}
     */
    const since = moment().subtract(6, 'days').format('MMM DD, YYYY');
    const filters = ['ALL', ['SUBJECT', filter], ['SINCE', since]];

    /**
     * imap 服务启动
     * @type {Connection}
     */
    const imap = new Imap({user, password, ...imapConfig});
    imap.connect();
    imap.once('error', err => updateProgress( `邮件抓取失败 ！！${err}`));
    imap.once('end', imap.end);

    async.waterfall([onReady, onSearch, onMsg]);

    /**
     * imap handlers
     */
    function onReady (cb) {
        return imap.once('ready', err => {
            if (err) {
                throw err
            }
            imap.openBox('INBOX', true, _ => cb(null))
        })
    }
    function onSearch (cb) {
        return imap.search(filters, (err, results) => {
            if (err) {
                throw err
            }
            cb(null, results)
        });
    }
    function onMsg (result) {
        updateProgress('开始抓取邮件 ！！');
        const f = imap.fetch(result, { bodies: '' });
        f.on('message', function (msg) {
            const mailParser = new MailParser();
            const tasks = [partial(onBody, mailParser, msg), partial(onHeader, mailParser), partial(onData, mailParser)];
            async.waterfall(tasks, (err, {headers, data}) => {
                if (err) {
                    updateProgress(err.message.slice(0, 20));
                }
                addWeekly(headers, data)
            });
        });
        f.once('end', partial(updateProgress, '邮件抓取结束 ！！'));
    }

    /********* utils ***********/

    /**
     * socket handlers
     */
    function updateProgress(msg) {
        return socket.emit('update progress', msg);
    }
    function addWeekly (headers, data) {
        return socket.emit('add weekly', format(headers, data));
    }

    /**
     * mailParser handlers
     */
    function onHeader (mailParser, cb) {
        return mailParser.on("headers", headers => cb(null, headers));
    }
    function onData (mailParser, headers, cb) {
        return mailParser.on("data", data => data.type === 'text' && data.html && cb(null, {headers, data}));
    }

    /**
     * mail msg handlers
     */
    function onBody(mailParser, msg, cb) {
        msg.on('body', stream => stream.pipe(mailParser) && cb(null));
    }
};

exports.sendEmail = function ({user, password, sendTo, sendCC, content, socket, smtp}) {
    const clientPrint = msg => socket.emit('update progress', msg);
    const msg = {
        subject: `better-fe 前端周刊 - ${moment().format('YYYY-MM-DD')}`,
        from: user,
        to: sendTo,
        cc: sendCC,
        attachment: [
            {data:`<html>${content}</html>`, alternative: true},
        ]
    };
    clientPrint('正在发送邮件 ！！');

    const server = sendEmail.server.connect({user, password, ...smtp});
    server.send(msg, (err, message) => {
        socket.emit('send end');

        if (!err) {
            return clientPrint('邮件发送成功！！请注意查收')
        }
        if (err.code === LOGIN_FAIL_CODE) {
            return clientPrint('认证失败，请检查用户名密码是否正确')
        }
        return clientPrint(`邮件发送失败！！${err.message.slice(0, 20)} ...`);
    });
};
