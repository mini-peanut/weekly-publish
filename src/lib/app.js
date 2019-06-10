const Koa = require('koa');
const app = new Koa();
const serve = require('koa-static');
const router = require('koa-router')();
const server = require('http').createServer(app.callback());
const io = require('socket.io')(server);
const fs = require('fs');
const path = require('path');
const AipNlpClient = require("baidu-aip-sdk").nlp;
const {fetchEmails, sendEmail} = require('./email');
const noop = require('lodash/noop')
const PORT = 8886;
// 设置APP_ID/AK/SK
const APP_ID = 16425951;
const API_KEY = 'AaGmOHO5TafrKLnxpElQMDkh';
const SECRET_KEY = 'Dbpy9jm39TlA1GxcL4Qxl01A7U3dM5DG';

// 新建一个对象，建议只保存一个对象调用服务接口
const client = new AipNlpClient(APP_ID, API_KEY, SECRET_KEY);

const PUBLIC_DIR = path.join(__dirname, '../../public');
const SRC_DIR = path.join(__dirname, '../');

module.exports = function (props) {
    const {
        users = [],     // 周刊推荐人员列表，如['张三', '李四']
        imap = {},      // imap config 如：{ host: 'xxx.com', port: 993, tls: true, ssl: false }
        smtp = {},      // smtp config 如：{ host: 'xxx.com', port: 993, tls: true }
        filter = '',    // 邮件筛选条件，比如 'better-fe' 会将主题中包含better-fe的提取出来，只支持英文
        admin = '',     // 管理员，在这里是收张三，和李四邮件并整理发布出去的同学
        sendTo = '',    // 收件人
        sendCC = '',    // 抄送,
        format = noop
    } = props;

    router.get('/', async ctx => {
        ctx.type = 'html';
        ctx.body = fs.createReadStream(path.resolve(SRC_DIR, 'index.html'));
    });
    router.get('/add-weekly', async ctx => {
        ctx.type = 'html';
        ctx.body = fs.createReadStream(path.resolve(SRC_DIR, 'add-weekly.html'));
    });

    app.use(router.routes());
    app.use(serve(PUBLIC_DIR));

    io.on('connection', function(socket) {
        socket.on('grab base info', function () {
            socket.emit('base info', {admin, users, to: sendTo, cc: sendCC})
        });
        socket.on('grab weekly', async ({user, password}) => {
            fetchEmails({user, password, imap, socket, filter, format});
        });
        socket.on('send weekly', async (user, password, content) => {
            sendEmail({user, password, sendTo, sendCC, content, socket, smtp})
        });
        socket.on('spell check', async content => {
            client.ecnet(content, null).then(function(result) {
                socket.emit('spell check result', result)
            });

            client.dnnlmCn(content, null).then(function(result) {
                socket.emit('dnn check', result);
            });
        })
    });

    server.listen(PORT);
};

