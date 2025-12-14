// ==UserScript==
// @name                bilibili直播净化
// @namespace           https://github.com/lzghzr/GreasemonkeyJS
// @version             4.3.7
// @author              lzghzr
// @description         增强直播屏蔽功能, 提高直播观看体验
// @icon                data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTUiIHN0cm9rZT0iIzAwYWVlYyIgc3Ryb2tlLXdpZHRoPSIyIiBmaWxsPSJub25lIi8+PHRleHQgZm9udC1mYW1pbHk9Ik5vdG8gU2FucyBDSksgU0MiIGZvbnQtc2l6ZT0iMjIiIHg9IjUiIHk9IjIzIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMCIgZmlsbD0iIzAwYWVlYyI+5ruaPC90ZXh0Pjwvc3ZnPg==
// @supportURL          https://github.com/lzghzr/GreasemonkeyJS/issues
// @match               https://live.bilibili.com/*
// @match               https://www.bilibili.com/blackboard/*
// @license             MIT
// @require             https://unpkg.com/ajax-hook@3.0.3/dist/ajaxhook.min.js
// @require             https://unpkg.com/crypto-js@4.2.0/crypto-js.js
// @require             https://unpkg.com/crc-32@1.2.2/crc32.js
// @compatible          chrome 基础功能需要 88 以上支持 :not() 伪类，高级功能需要 105 及以上支持 :has() 伪类
// @compatible          edge 基础功能需要 88 以上支持 :not() 伪类，高级功能需要 105 及以上支持 :has() 伪类
// @compatible          firefox 基础功能需要 84 以上支持 :not() 伪类，高级功能需要 121 及以上支持 :has() 伪类
// @grant               GM_addStyle
// @grant               GM_getValue
// @grant               GM_setValue
// @grant               unsafeWindow
// @run-at              document-start
// ==/UserScript==
const W = typeof unsafeWindow === 'undefined' ? window : unsafeWindow;
class DB {
  dbName;
  objectStoreName;
  keyPath;
  db;
  constructor(dbName, objectStoreName, keyPath) {
    this.dbName = dbName;
    this.objectStoreName = objectStoreName;
    this.keyPath = keyPath;
  }
  open(store) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName);
      request.onerror = () => {
        reject(request.error);
      };
      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };
      request.onupgradeneeded = () => {
        this.db = request.result;
        if (!this.db.objectStoreNames.contains(this.objectStoreName)) {
          const objectStore = this.db.createObjectStore(this.objectStoreName, { keyPath: this.keyPath });
          store.forEach(vaule => {
            objectStore.createIndex(vaule[0], vaule[0], { unique: vaule[1] });
          });
        }
      };
    });
  }
  putData(data) {
    return new Promise((resolve, reject) => {
      const store = this.db.transaction([this.objectStoreName], 'readwrite').objectStore(this.objectStoreName);
      const request = store.put(data);
      request.onerror = () => {
        reject(request.error);
      };
      request.onsuccess = () => {
        resolve();
      };
    });
  }
  getData(key) {
    return new Promise((resolve, reject) => {
      const store = this.db.transaction([this.objectStoreName], 'readonly').objectStore(this.objectStoreName);
      const request = store.get(key);
      request.onerror = () => {
        reject(request.error);
      };
      request.onsuccess = () => {
        resolve(request.result);
      };
    });
  }
}
class Tools {
  static str2Fn(str) {
    const fnReg = str.match(/([^\{]*)\{(.*)\}$/s);
    if (fnReg !== null) {
      const [, head, body] = fnReg;
      const args = head.replaceAll(/function[^\(]*|[\s()=>]/g, '').split(',');
      return new Function(...args, body);
    }
  }
  static scriptName(name) {
    return [
      `%c ${GM_info.script.name} %c ${name} `,
      "padding: 2px 6px; border-radius: 3px 0 0 3px; color: #ffffff; background: #FF6699; font-weight: bold;",
      "padding: 2px 6px; border-radius: 0 3px 3px 0; color: #ffffff; background: #FF9999; font-weight: bold;"
    ];
  }
  static sleep(ms) {
    return new Promise(resolve => setTimeout(() => resolve('sleep'), ms));
  }
  static crc32(num) {
    return (CRC32.str(num.toString()) >>> 0).toString(16);
  }
  static md5(str) {
    return CryptoJS.MD5(str).toString(CryptoJS.enc.Hex);
  }
  static querySign(url) {
    let search = url.split('?')[1]
      .replace(/&w_rid=\w+/, '')
      .replace(/&wts=\d+/, '');
    const searchSorted = search.split('&').sort().join('&');
    const wts = Math.round(Date.now() / 1000);
    const salt = W.__wbi_salt || 'ea1db124af3c7062474693fa704f4ff8';
    const wrid = Tools.md5(`${searchSorted}&wts=${wts}${salt}`);
    return `${url.split('?')[0]}?${search}&w_rid=${wrid}&wts=${wts}`;
  }
}
class NoVIP {
  elmStyleCSS;
  chatObserver;
  danmakuObserver;
  defaultConfig = {
    version: 1764243154073,
    menu: {
      noGiftMsg: {
        name: '屏蔽礼物相关',
        replace: '屏蔽全部礼物及广播',
        enable: false
      },
      noSystemMsg: {
        name: '屏蔽系统消息',
        replace: '屏蔽进场信息',
        enable: false
      },
      noSuperChat: {
        name: '屏蔽醒目留言',
        replace: '屏蔽醒目留言',
        enable: false
      },
      noEmoticons: {
        name: '屏蔽表情聊天',
        replace: '屏蔽表情动画（右下角）',
        enable: false
      },
      noEmotDanmaku: {
        name: '屏蔽表情弹幕',
        replace: '屏蔽表情弹幕',
        enable: false
      },
      noLikeBtn: {
        name: '屏蔽点赞按钮',
        enable: false
      },
      noGiftControl: {
        name: '屏蔽活动控件',
        enable: false
      },
      noGuardIcon: {
        name: '屏蔽舰队标识',
        enable: false
      },
      noWealthMedalIcon: {
        name: '屏蔽荣耀勋章',
        enable: false
      },
      noFansMedalIcon: {
        name: '屏蔽粉丝勋章',
        enable: false
      },
      noLiveTitleIcon: {
        name: '屏蔽成就头衔',
        enable: false
      },
      noRaffle: {
        name: '屏蔽抽奖橱窗',
        enable: false
      },
      noDanmakuColor: {
        name: '屏蔽弹幕颜色',
        enable: false
      },
      noGameId: {
        name: '屏蔽互动游戏',
        enable: false
      },
      noBBChat: {
        name: '屏蔽刷屏聊天',
        enable: false
      },
      noBBDanmaku: {
        name: '屏蔽刷屏弹幕',
        enable: false
      },
      noMirrorDanmaku: {
        name: '屏蔽跨房弹幕',
        enable: false
      },
      noRoomSkin: {
        name: '屏蔽房间皮肤',
        enable: false
      },
      noActivityPlat: {
        name: '屏蔽活动皮肤*',
        enable: false
      },
      noRoundPlay: {
        name: '屏蔽视频轮播*',
        enable: false
      },
      noSleep: {
        name: '屏蔽挂机检测*',
        enable: false
      },
      rankInvisible: {
        name: '在线榜单隐身*',
        enable: false
      },
      invisible: {
        name: '进场隐身观看*',
        enable: false
      }
    }
  };
  config;
  replaceMenu = new Set();
  rankInvisible = true;
  userInfoDB;
  message = [];
  constructor() {
    const userConfig = GM_getValue('blnvConfig', null) === null ? this.defaultConfig : JSON.parse(decodeURI(GM_getValue('blnvConfig')));
    if (userConfig.version === undefined || userConfig.version < this.defaultConfig.version) {
      for (const x in this.defaultConfig.menu) {
        try {
          this.defaultConfig.menu[x].enable = userConfig.menu[x].enable;
        }
        catch (error) {
          console.error(...Tools.scriptName('载入配置失效'), error);
        }
      }
      this.config = this.defaultConfig;
    }
    else {
      this.config = userConfig;
    }
    for (const x in this.config.menu) {
      this.replaceMenu.add(this.config.menu[x].replace);
    }
  }
  init() {
    W.getComputedStyle = new Proxy(W.getComputedStyle, {
      apply: function (target, _this, args) {
        if (args !== undefined && args[0] instanceof HTMLElement) {
          let htmlEle = Reflect.apply(target, _this, args);
          htmlEle = new Proxy(htmlEle, {
            get: function (_target, propertyKey) {
              if (propertyKey === 'display' && _target[propertyKey] === 'none') {
                return 'block';
              }
              return Reflect.get(_target, propertyKey);
            }
          });
          return htmlEle;
        }
        return Reflect.apply(target, _this, args);
      }
    });
    Object.defineProperty(W, '__NEPTUNE_IS_MY_WAIFU__', { value: {} });
    const waitWebpack = setInterval(() => {
      if (W.webpackChunklive_room !== undefined) {
        clearInterval(waitWebpack);
        this.replaceFunction();
      }
    }, 0);
    const waitRoomBuff = setInterval(() => {
      if (W.roomBuffService !== undefined) {
        clearInterval(waitRoomBuff);
        this.replaceRoomBuff();
      }
    }, 0);
  }
  replaceRoomBuff() {
    W.roomBuffService.mount = new Proxy(W.roomBuffService.mount, {
      apply: function (target, _this, args) {
        if (args[0] !== undefined) {
          _this.__NORoomSkin_skin = args[0];
          if (args[0].id !== 0) {
            _this.__NORoomSkin_skin_id = args[0].id;
          }
          if (_this.__NORoomSkin) {
            args[0].id = 0;
            args[0] = {};
          }
          else if (args[0].id === 0 && args[0].start_time !== 0) {
            args[0].id = _this.__NORoomSkin_skin_id || 0;
          }
        }
        return Reflect.apply(target, _this, args);
      }
    });
    W.roomBuffService.unmount = new Proxy(W.roomBuffService.unmount, {
      apply: function (target, _this, args) {
        if (_this.__NORoomSkin_skin !== undefined) {
          _this.__NORoomSkin_skin.id = 0;
        }
        return Reflect.apply(target, _this, args);
      }
    });
  }
  replaceFunction() {
    const that = this;
    W.webpackChunklive_room.push = new Proxy(W.webpackChunklive_room.push, {
      apply: function (target, _this, args) {
        for (const [name, fn] of Object.entries(args[0][1])) {
          let fnStr = fn.toString();
          if (fnStr.includes('staticClass:"block-effect-icon-root"')) {
            const regexp = /(?<left>staticClass:"block-effect-icon-root"\},\[)"on"===(?<mut_t>\w+)\.blockEffectStatus\?(?<svg>(?<mut_n>\w+)\("svg".*?)\[\k<mut_n>\("path".*?blockEffectIconColor\}\}\)\]/s;
            const match = fnStr.match(regexp);
            if (match !== null) {
              fnStr = fnStr.replace(regexp, '$<left>$<svg>\[\
$<mut_n>("circle",{attrs:{cx:"12",cy:"12",r:"10",stroke:$<mut_t>.blockEffectIconColor,"stroke-width":"1.5",fill:"none"}}),\
$<mut_t>._v(" "),\
$<mut_n>("text",{attrs:{"font-family":"Noto Sans CJK SC","font-size":"14",x:"5",y:"17",fill:$<mut_t>.blockEffectIconColor}},[$<mut_t>._v("滚")])\
]');
              console.info(...Tools.scriptName('脚本 icon 已加载'));
            }
            else {
              console.error(...Tools.scriptName('插入脚本 icon 失效'), fnStr);
            }
          }
          if (fnStr.includes('return this.chatList.children.length')) {
            const regexp = /(?<left>return )this\.chatList\.children\.length/s;
            const match = fnStr.match(regexp);
            if (match !== null) {
              fnStr = fnStr.replace(regexp, '$<left>this.chatList.querySelectorAll(".danmaku-item:not(.NoVIP_hide)").length');
              console.info(...Tools.scriptName('增强聊天显示 已加载'));
            }
            else {
              console.error(...Tools.scriptName('增强聊天显示失效'), fnStr);
            }
          }
          if (that.config.menu.noRoundPlay.enable) {
            if (fnStr.includes('case"PREPARING":')) {
              const regexp = /(?<left>case"PREPARING":)(?<right>[^;]+\((?<mut>\w+)\);break;)/s;
              const match = fnStr.match(regexp);
              if (match !== null) {
                fnStr = fnStr.replace(regexp, '$<left>$<mut>.round=0;$<right>');
                console.info(...Tools.scriptName('屏蔽下播轮播 已加载'));
              }
              else {
                console.error(...Tools.scriptName('屏蔽下播轮播失效'), fnStr);
              }
            }
          }
          if (that.config.menu.noSleep.enable) {
            if (fnStr.includes('prototype.sleep=function(')) {
              const regexp = /(?<left>prototype\.sleep=function\(\w*\){)/;
              const match = fnStr.match(regexp);
              if (match !== null) {
                fnStr = fnStr.replace(regexp, '$<left>return;');
                console.info(...Tools.scriptName('屏蔽挂机检测 已加载'));
              }
              else {
                console.error(...Tools.scriptName('屏蔽挂机检测失效'), fnStr);
              }
            }
          }
          if (that.config.menu.rankInvisible.enable) {
            if (fnStr.includes('this.enterRoomTracker=new ')) {
              const regexp = /(?<left>this\.enterRoomTracker=new \w+),/s;
              const match = fnStr.match(regexp);
              if (match !== null) {
                fnStr = fnStr.replace(regexp, '$<left>,this.enterRoomTracker.report=()=>{},');
                console.info(...Tools.scriptName('在线榜单隐身 已加载'));
              }
              else {
                console.error(...Tools.scriptName('在线榜单隐身失效'), fnStr);
              }
            }
          }
          if (fnStr.includes('join("&");return{w_rid:')) {
            const regexp = /(?<right>return{w_rid:.*?\+(?<mut>\w+)\))/s;
            const match = fnStr.match(regexp);
            if (match !== null) {
              fnStr = fnStr.replace(regexp, 'self.__wbi_salt=$<mut>;$<right>');
              console.info(...Tools.scriptName('wbi_key 已加载'));
            }
            else {
              console.error(...Tools.scriptName('wbi_key失效'), fnStr);
            }
          }
          if (fn.toString() !== fnStr) {
            args[0][1][name] = Tools.str2Fn(fnStr);
          }
        }
        return Reflect.apply(target, _this, args);
      }
    });
    if (this.config.menu.rankInvisible.enable
      || this.config.menu.noRoundPlay.enable) {
      Array.prototype.concat = new Proxy(Array.prototype.concat, {
        apply: function (target, _this, args) {
          if (args[0] && args[0] instanceof Object && args[0].cmd) {
            const command = args[0];
            if (command.cmd === 'DANMU_MSG_MIRROR') {
              command['info'][0][3] = 0xfefefe;
            }
            if (that.config.menu.rankInvisible.enable) {
              if (command.cmd.startsWith('DANMU_MSG')) {
                const user = command.info[0][15].user;
                if (user.uid !== 0) {
                  that.addUserInfo([{ uid: user.uid, name: user.base.name }]);
                }
                else if (that.userInfoDB !== undefined) {
                  args[0] = [];
                  that.userInfoDB.getData(command.info[0][7].replace(/^0+/, '')).then(userInfo => {
                    if (userInfo !== undefined) {
                      command.info[2][0] = userInfo.uid;
                      command.info[2][1] = userInfo.name;
                      user.uid = userInfo.uid;
                      user.base.name = userInfo.name;
                    }
                    that.message.push(command);
                  });
                }
              }
              else if (command?.data?.uinfo?.uid !== 0 && command?.data?.uinfo?.base?.name) {
                that.addUserInfo([{ uid: command.data.uinfo.uid, name: command.data.uinfo.base.name }]);
              }
              if (that.message.length !== 0) {
                args.push(that.message);
                that.message = [];
              }
            }
            if (that.config.menu.noRoundPlay.enable) {
              if (command.cmd === 'PREPARING') {
                command.round = 0;
              }
            }
          }
          return Reflect.apply(target, _this, args);
        }
      });
    }
    if (this.config.menu.rankInvisible.enable) {
      JSON.stringify = new Proxy(JSON.stringify, {
        apply: function (target, _this, args) {
          if (args[0] && args[0] instanceof Object) {
            const value = args[0];
            if (that.config.menu.rankInvisible.enable && that.rankInvisible) {
              if (value.uid && value.roomid && value.protover == 3) {
                value.uid = 0;
              }
            }
          }
          return Reflect.apply(target, _this, args);
        }
      });
    }
    if (this.config.menu.rankInvisible.enable
      || this.config.menu.invisible.enable
      || this.config.menu.noRoomSkin.enable
      || this.config.menu.noRoundPlay.enable) {
      ah.proxy({
        onRequest: (XHRconfig, handler) => {
          if (this.config.menu.rankInvisible.enable && this.rankInvisible) {
            if (XHRconfig.url.includes('/xlive/web-room/v1/index/getDanmuInfo')) {
              XHRconfig.withCredentials = false;
              console.info(...Tools.scriptName('在线榜单隐身 已拦截'));
            }
          }
          if (this.config.menu.invisible.enable) {
            if (XHRconfig.url.includes('/xlive/web-room/v1/index/getInfoByUser')) {
              let query = XHRconfig.url.replace(/room_id=\d+/, 'room_id=273022');
              XHRconfig.url = Tools.querySign(query);
              console.info(...Tools.scriptName('隐藏进场信息 已拦截'));
            }
          }
          handler.next(XHRconfig);
        },
        onResponse: async (XHRresponse, handler) => {
          if (XHRresponse.config.url.includes('/xlive/web-room/v1/index/getInfoByRoom')) {
            XHRresponse.response = XHRresponse.response.replace('"open_anonymous":true', '"open_anonymous":false');
            console.info(...Tools.scriptName('房间匿名信息 已拦截'));
          }
          if (this.config.menu.noRoomSkin.enable) {
            if (XHRresponse.config.url.includes('/xlive/app-room/v2/guardTab/topList')) {
              XHRresponse.response = XHRresponse.response.replace(/"anchor_guard_achieve_level":\d+/, '"anchor_guard_achieve_level":0');
              console.info(...Tools.scriptName('屏蔽大航海榜单背景图 已拦截'));
            }
          }
          if (that.config.menu.noRoundPlay.enable || that.config.menu.rankInvisible.enable) {
            if (XHRresponse.config.url.includes('/xlive/web-room/v2/index/getRoomPlayInfo')) {
              const body = JSON.parse(XHRresponse.response);
              if (that.config.menu.noRoundPlay.enable) {
                if (body.data.live_status == 2) {
                  body.data.live_status = 0;
                }
                console.info(...Tools.scriptName('屏蔽视频轮播 已拦截'));
              }
              if (that.config.menu.rankInvisible.enable) {
                await that.getRank(body.data.room_id, body.data.uid);
                console.info(...Tools.scriptName('在线榜单隐身 已添加'));
              }
              XHRresponse.response = JSON.stringify(body);
            }
          }
          if (this.config.menu.invisible.enable) {
            if (XHRresponse.config.url.includes('/xlive/web-room/v1/index/getInfoByUser')) {
              XHRresponse.response = XHRresponse.response.replace('"is_room_admin":false', '"is_room_admin":true');
              console.info(...Tools.scriptName('隐藏进场信息 已拦截'));
            }
          }
          if (this.config.menu.noRoundPlay.enable) {
            if (XHRresponse.config.url.includes('/live/getRoundPlayVideo')) {
              XHRresponse.status = 403;
              console.info(...Tools.scriptName('屏蔽视频轮播 已拦截'));
            }
          }
          handler.next(XHRresponse);
        }
      }, W);
      const checkHookFetchAlive = async () => {
        this.hookFetch();
        for (let i = 0; i < 50; i++) {
          await W.fetch('//blnv_test_fetch_hook_alive/').catch(() => { this.hookFetch(); });
          await Tools.sleep(100);
        }
      };
      checkHookFetchAlive();
    }
  }
  hookFetch() {
    const that = this;
    W.fetch = new Proxy(W.fetch, {
      apply: async function (target, _this, args) {
        const resource = args[0];
        let url = (resource instanceof Request) ? resource.url : resource;
        if (url.includes('/xlive/web-room/v1/index/getInfoByRoom')) {
          const response = await Reflect.apply(target, _this, args);
          const body = await response.text();
          const newResponse = new Response(body.replace('"open_anonymous":true', '"open_anonymous":false'));
          console.info(...Tools.scriptName('房间匿名信息 已拦截'));
          return newResponse;
        }
        if (that.config.menu.rankInvisible.enable && that.rankInvisible) {
          if (url.includes('/xlive/web-room/v1/index/getDanmuInfo')) {
            args[1] ? args[1].credentials = 'same-origin' : args[1] = { credentials: 'same-origin' };
            console.info(...Tools.scriptName('在线榜单隐身 已拦截'));
          }
        }
        if (that.config.menu.invisible.enable) {
          if (url.includes('/xlive/web-room/v1/index/getInfoByUser')) {
            let query = url.replace(/room_id=\d+/, 'room_id=273022');
            url = Tools.querySign(query);
            args[0] = (resource instanceof Request) ? new Request(url, resource) : url;
            const response = await Reflect.apply(target, _this, args);
            const body = await response.text();
            const newResponse = new Response(body.replace('"is_room_admin":false', '"is_room_admin":true'));
            console.info(...Tools.scriptName('隐藏进场信息 已拦截'));
            return newResponse;
          }
        }
        if (that.config.menu.noRoomSkin.enable) {
          if (url.includes('/xlive/app-room/v2/guardTab/topList')) {
            const response = await Reflect.apply(target, _this, args);
            const body = await response.json();
            body.data.info.anchor_guard_achieve_level = 0;
            const newResponse = new Response(JSON.stringify(body));
            console.info(...Tools.scriptName('屏蔽大航海榜单背景图 已拦截'));
            return newResponse;
          }
        }
        if (that.config.menu.noRoundPlay.enable || that.config.menu.rankInvisible.enable) {
          if (url.includes('/xlive/web-room/v2/index/getRoomPlayInfo')) {
            const response = await Reflect.apply(target, _this, args);
            const body = await response.json();
            if (that.config.menu.noRoundPlay.enable) {
              if (body.data.live_status == 2) {
                body.data.live_status = 0;
              }
              console.info(...Tools.scriptName('屏蔽视频轮播 已拦截'));
            }
            if (that.config.menu.rankInvisible.enable) {
              await that.getRank(body.data.room_id, body.data.uid);
              console.info(...Tools.scriptName('在线榜单隐身 已添加'));
            }
            const newResponse = new Response(JSON.stringify(body));
            return newResponse;
          }
        }
        if (that.config.menu.noRoundPlay.enable) {
          if (url.includes('/live/getRoundPlayVideo')) {
            const response = await Reflect.apply(target, _this, args);
            const newResponse = new Response(response.body, {
              status: 403,
              statusText: 'Forbidden',
              headers: response.headers
            });
            console.info(...Tools.scriptName('屏蔽视频轮播 已拦截'));
            return newResponse;
          }
        }
        if (url.includes('//blnv_test_fetch_hook_alive/')) {
          return new Response('success');
        }
        return Reflect.apply(target, _this, args);
      }
    });
  }
  start() {
    this.elmStyleCSS = GM_addStyle('');
    this.addCSS();
    const chatMessage = new Map();
    this.chatObserver = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(addedNode => {
          if (addedNode instanceof HTMLDivElement && addedNode.classList.contains('danmaku-item')) {
            const nameNode = addedNode.querySelector('.danmaku-item-left');
            const chatNode = addedNode.querySelector('.danmaku-item-right');
            if (chatNode !== null) {
              if (nameNode !== null && nameNode.querySelector('.user-name') === null) {
                const nameSpan = document.createElement('span');
                nameSpan.className = 'user-name v-middle pointer open-menu';
                nameSpan.innerText = addedNode.dataset['uname'] + " : " || '跨房用户';
                nameNode.appendChild(nameSpan);
              }
            }
            const chatText = chatNode.innerText;
            const dateNow = Date.now();
            if (chatMessage.has(chatText) && dateNow - chatMessage.get(chatText) < 10_000) {
              addedNode.classList.add('NoVIP_chat_hide');
            }
            else {
              chatMessage.set(chatText, dateNow);
            }
          }
        });
      });
    });
    const elmDivChatList = document.querySelector('#chat-items');
    if (elmDivChatList !== null) {
      this.chatObserver.observe(elmDivChatList, { childList: true });
    }
    const danmakuMessage = new Map();
    this.danmakuObserver = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(addedNode => {
          const danmakuNode = addedNode instanceof Text ? addedNode.parentElement : addedNode;
          if (danmakuNode?.classList?.contains('danmaku-item-container')) {
            this.danmakuObserver.disconnect();
            this.danmakuObserver.observe(danmakuNode, { childList: true });
          }
          else if (danmakuNode?.classList?.contains('bili-danmaku-x-dm')) {
            danmakuNode.addEventListener('animationstart', () => {
              const danmakuText = danmakuNode.innerText.split(/ ?[x×]\d+$/);
              const dateNow = Date.now();
              if (danmakuMessage.has(danmakuText[0]) && dateNow - danmakuMessage.get(danmakuText[0]) < 10_000) {
                danmakuNode.classList.add('NoVIP_danmaku_hide');
              }
              else if (danmakuText[1] !== undefined) {
                danmakuNode.classList.add('NoVIP_danmaku_hide');
              }
              else {
                danmakuMessage.set(danmakuText[0], dateNow);
              }
            });
          }
        });
      });
    });
    const elmDivDanmaku = document.querySelector('#live-player');
    if (elmDivDanmaku !== null) {
      this.danmakuObserver.observe(elmDivDanmaku, { childList: true, subtree: true });
    }
    setInterval(() => {
      const dateNow = Date.now();
      chatMessage.forEach((value, key) => {
        if (dateNow - value > 60_000) {
          chatMessage.delete(key);
        }
      });
      danmakuMessage.forEach((value, key) => {
        if (dateNow - value > 60_000) {
          danmakuMessage.delete(key);
        }
      });
    }, 60_000);
    const docObserver = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(addedNode => {
          if (addedNode instanceof HTMLDivElement) {
            if (addedNode.classList.contains('dialog-ctnr')) {
              const blockEffectCtnr = addedNode.querySelector('.block-effect-ctnr');
              if (blockEffectCtnr !== null) {
                this.addUI(blockEffectCtnr);
              }
            }
          }
        });
      });
    });
    docObserver.observe(document, { childList: true, subtree: true });
    const blcok = localStorage.getItem('LIVE_BLCOK_EFFECT_STATE');
    if (blcok !== null) {
      const block = blcok.split(',').filter(item => item === '2' || item === '9');
      localStorage.setItem('LIVE_BLCOK_EFFECT_STATE', block.join(','));
    }
    this.changeCSS();
  }
  noRoomSkin() {
    if (this.config.menu.noRoomSkin.enable) {
      W.roomBuffService.__NORoomSkin = true;
      W.roomBuffService.unmount();
    }
    else {
      W.roomBuffService.__NORoomSkin = false;
      W.roomBuffService.mount(W.roomBuffService.__NORoomSkin_skin);
    }
  }
  changeCSS() {
    let height = 62;
    let cssText = `
/* 统一用户名颜色 */
.chat-item .user-name {
  color: var(--brand_blue) !important;
}`;
    if (this.config.menu.noGuardIcon.enable) {
      cssText += `
/* 聊天背景 */
.chat-item.chat-colorful-bubble {
  background-color: unset !important;
  border-image-source: unset !important;
  border-radius: unset !important;
  display: block !important;
  margin: unset !important;
}
/* 聊天背景 */
.chat-item.chat-colorful-bubble div:has(div[style*="border-image-source"]),
/* 欢迎提示条 */
#welcome-area-bottom-vm,
/* 粉丝勋章内标识 */
.chat-item .fans-medal-item-ctnr .medal-guard,
/* 舰队指挥官标识 */
.chat-item .pilot-icon,
.chat-item .pilot-icon ~ br,
/* 订阅舰长 */
.chat-item.guard-buy {
  display: none !important;
}
/* 兼容chrome 105以下版本 */
@supports not selector(:has(a, b)) {
  .chat-item.chat-colorful-bubble div[style*="border-image-source"] {
  display: none !important;
  }
}`;
    }
    if (this.config.menu.noWealthMedalIcon.enable) {
      cssText += `
/* 聊天背景, 存疑 */
.chat-item.wealth-bubble {
  border-image-source: unset !important;
}
/* 聊天背景, 存疑 */
.chat-item.has-bubble {
  border-image-source: unset !important;
  border-image-slice: unset !important;
  border-image-width: unset !important;
  box-sizing: unset !important;
  display: block !important;
  margin: unset !important;
}
.chat-item.has-bubble .danmaku-item-left > br,
/* 欢迎提示条 */
#welcome-area-bottom-vm,
/* 弹幕 */
.bili-danmaku-x-dm > .bili-icon,
/* 聊天 */
.chat-item .wealth-medal-ctnr {
  display: none !important;
}`;
    }
    if (this.config.menu.noGiftMsg.enable) {
      height -= 32;
      cssText += `
/* 底部小礼物, 调整高度 */
.chat-history-list.with-penury-gift {
  height: 100% !important;
}
/* 热门流量推荐 */
.chat-item.hot-rank-msg,
/* VIP标识 */
#activity-welcome-area-vm,
.chat-item .vip-icon,
.chat-item.welcome-msg,
/* 高能标识 */
.chat-item.top3-notice,
.chat-item .rank-icon,
/* 分享直播间 */
.chat-item.important-prompt-item,
/* 礼物栏 */
.gift-control-panel > *:not(.left-part-ctnr),
#web-player__bottom-bar__container,
/* 礼物按钮 */
#web-player-controller-wrap-el .web-live-player-gift-icon-wrap,
/* 主播心愿 */
.gift-wish-card-root,

#chat-gift-bubble-vm,
#penury-gift-msg,
#gift-screen-animation-vm,
#my-dear-haruna-vm .super-gift-bubbles,
.chat-item.gift-item,
.chat-item.system-msg,

.web-player-inject-wrap .announcement-wrapper,
.bilibili-live-player-video-operable-container>div:first-child>div:last-child,
.bilibili-live-player-video-gift,
.bilibili-live-player-danmaku-gift {
  display: none !important;
}`;
    }
    if (this.config.menu.noSystemMsg.enable) {
      height -= 30;
      cssText += `
.chat-history-list.with-brush-prompt {
  height: 100% !important;
}
/* 跨房 */
.uni-live-prefix-tag,
/* 目前只看到冲榜提示 */
.chat-history-panel #all-guide-cards,
/* 聊天下方滚动消息，进场、点赞之类的 */
#brush-prompt,
/* 初始系统提示 */
.chat-item.convention-msg,
/* 各种野生消息 */
.chat-item.common-danmuku-msg,
/* 各种野生消息 x2 */
.chat-item.misc-msg,
/* 各种野生消息 x3 (Toasts) */
.link-toast,
/* pk */
.chat-item.new-video-pk-item-dm {
  display: none !important;
}`;
    }
    if (this.config.menu.noSuperChat.enable) {
      cssText += `
/* 调整 SuperChat 聊天框 */
.chat-history-list {
  padding-top: 5px !important;
}
.chat-item.superChat-card-detail {
  margin-left: unset !important;
  margin-right: unset !important;
  min-height: unset !important;
}
.chat-item .card-item-middle-top {
  background-color: unset !important;
  background-image: unset !important;
  border: unset !important;
  display: inline !important;
  padding: unset !important;
}
.chat-item .card-item-middle-top-right {
  display: unset !important;
}
.chat-item .superChat-base {
  display: unset !important;
  height: unset !important;
  line-height: unset !important;
  vertical-align: unset !important;
  width: unset !important;
}
.chat-item .superChat-base .fans-medal-item-ctnr {
  margin-right: 4px !important;
}
.chat-item .name,
.chat-item .card-item-name {
  display: unset !important;
  font-size: unset !important;
  font-weight: unset !important;
  height: unset !important;
  line-height: 20px !important;
  margin-left: unset !important;
  opacity: unset !important;
  overflow: unset !important;
  text-overflow: unset !important;
  vertical-align: unset !important;
  white-space: unset !important;
  width: unset !important;
}
.chat-item .card-item-name>span {
  color: var(--brand_blue) !important;
}
/* 为 SuperChat 用户名添加 : */
.chat-item.superChat-card-detail .name:after,
.chat-item.superChat-card-detail .card-item-name>span:after {
  content: ' : ';
}
.chat-item .card-item-middle-bottom {
  background-color: unset !important;
  display: unset !important;
  padding: unset !important;
}
.chat-item .input-contain {
  display: unset !important;
}
.chat-item .text {
  color: var(--text2) !important;
}
/* SuperChat 提示条 */
#chat-msg-bubble-vm,
/* SuperChat 保留条 */
#pay-note-panel-vm,
.chat-item .bottom-background,
/* SuperChat 聊天条 右上角电池 */
.chat-item .card-item-top-right,
/* SuperChat 按钮 */
#chat-control-panel-vm .super-chat {
  display: none !important;
}`;
    }
    if (this.config.menu.noEmoticons.enable) {
      cssText += `
#chat-control-panel-vm .emoticons-panel,
.chat-item.chat-emoticon {
  display: none !important;
}`;
    }
    if (this.config.menu.noEmotDanmaku.enable) {
      cssText += `
.bili-danmaku-x-dm > img:not(.bili-icon) {
  display: none !important;
}`;
    }
    if (this.config.menu.noLikeBtn.enable) {
      cssText += `
/* 点赞按钮 */
#chat-control-panel-vm .like-btn,
/* 点赞消息 */
.chat-item[data-type="6"],
/* 点赞数 */
#head-info-vm .icon-ctnr:has(.like-icon) {
  display: none !important;
}
/* 兼容chrome 105以下版本 */
@supports not selector(:has(a, b)) {
  #head-info-vm .like-icon,
  #head-info-vm .like-text {
  display: none !important;
  }
}`;
    }
    if (this.config.menu.noGiftControl.enable) {
      cssText += `
/* 排行榜 */
.rank-list-section .gift-rank-cntr .top3-cntr .default,
.rank-list-section .guard-rank-cntr:not(.open) .guard-empty {
  height: 42px !important;
}
.rank-list-section .guard-rank-cntr:not(.open) .guard-empty {
  background-size: contain !important;
  background-position: center !important;
  background-repeat: no-repeat !important;
}
.rank-list-section .gift-rank-cntr .top3-cntr .default-msg {
  bottom: -12px !important;
}
.rank-list-section,
.rank-list-section.new .rank-list-ctnr[style*="height: 178px;"] {
  height: 98px !important;
}
.rank-list-section .tab-content,
.rank-list-section .tab-content-pilot,
.rank-list-section.new .guard-rank-cntr .rank-list-cntr {
  min-height: unset !important;
}
.rank-list-section .tab-content[style*="height: 9"],
.rank-list-section .tab-content-pilot[style*="height: 9"],
.rank-list-section .gift-rank-cntr .top3-cntr {
  height: 64px !important;
}
.rank-list-section .guard-rank-cntr .top3-cntr > span {
  height: 32px !important;
}
.rank-list-section.new .gift-rank-cntr .top3-cntr,
.rank-list-section.new .guard-rank-cntr {
  height: unset !important;
}
.rank-list-section.new .gift-rank-cntr .top3-cntr {
  padding-top: 5px !important;
}
.rank-list-section.new .guard-rank-cntr .top3-cntr {
  top: 15px !important;
}
/* 调整聊天区 */
.chat-history-panel {
  height: calc(100% - 145px) !important;
  padding-bottom: 0px !important;
}
/* 有些直播间没有排行榜 */
.rank-list-section~.chat-history-panel {
  height: calc(100% - 98px - 145px) !important;
}
/* 有些直播间 .chat-history-panel 没有 .new */
#aside-area-vm:has(.control-panel-ctnr-new) .chat-history-panel {
  height: calc(100% - 114px) !important;
}
#aside-area-vm:has(.control-panel-ctnr-new) .rank-list-section~.chat-history-panel {
  height: calc(100% - 98px - 114px) !important;
}
.player-full-win #aside-area-vm:has(.control-panel-ctnr-new) .chat-history-panel {
  height: calc(100% - 104px) !important;
}
#aside-area-vm:has(.control-panel-ctnr-new) #chat-control-panel-vm {
  height: 114px !important;
}
#chat-control-panel-vm .control-panel-ctnr-new {
  padding-top: 5px !important;
}
#chat-control-panel-vm .chat-input-ctnr-new {
  margin-top: 5px !important;
}
#chat-control-panel-vm .control-panel-ctnr-new .danmakuPreference,
#chat-control-panel-vm .control-panel-ctnr-new .blockSetting,
#chat-control-panel-vm .control-panel-ctnr-new .effectBlock {
  bottom: 114px !important;
}
/* 直播分区 */
.live-area {
  display: flex !important;
}
/* 排行榜 */
.rank-list-section.new .gift-rank-cntr .top3 > div ~ div,
.rank-list-section.new .guard-rank-cntr .top3-cntr > span ~ span,
.rank-list-section.new .pilot,
/* 人气榜 */
#head-info-vm .popular-and-hot-rank,
#head-info-vm #LiveRoomHotrankEntries,
/* 礼物星球 */
#head-info-vm .gift-planet-entry,
/* 活动榜 */
#head-info-vm .activity-entry,
/* 粉丝团  */
#head-info-vm .follow-ctnr,
/* 头像框 */
.blive-avatar-pendant,
/* 主播城市 */
.anchor-location,
/* 水印 */
.web-player-icon-roomStatus,
.blur-edges-ctnr,
/* 遮罩 */
#web-player-module-area-mask-panel {
  display: none !important;
}
/* 兼容chrome 105以下版本 */
@supports not selector(:has(a, b)) {
  .chat-history-panel.new {
  height: calc(100% - 114px) !important;
  }
  .rank-list-section~.chat-history-panel.new {
  height: calc(100% - 98px - 114px) !important;
  }
  .chat-history-panel.new~#chat-control-panel-vm {
  height: 114px !important;
  }
  .player-full-win #aside-area-vm .chat-history-panel.new {
  height: calc(100% - 104px) !important;
  }
}`;
    }
    if (this.config.menu.noFansMedalIcon.enable) {
      cssText += `
/* 团体勋章 */
.chat-item .group-medal-ctnr,
/* 团体勋章 底部提示条 */
#brush-prompt .group-medal-ctnr,
/* 粉丝勋章 聊天 */
.chat-item .fans-medal-item-ctnr,
/* 粉丝勋章 底部提示条 */
#brush-prompt .fans-medal-item-ctnr {
  display: none !important;
}`;
    }
    if (this.config.menu.noLiveTitleIcon.enable) {
      cssText += `
.chat-item .title-label {
  display: none !important;
}`;
    }
    if (this.config.menu.noRaffle.enable) {
      cssText += `
body:not(.player-full-win):has(iframe[src*="live-lottery"])[style*="overflow: hidden;"] {
  overflow-y: overlay !important;
}
#shop-popover-vm,
#anchor-guest-box-id,
#player-effect-vm,
#chat-draw-area-vm,
.m-nobar__popup-container:has(iframe[src*="live-lottery"]),
/* 天选之类的 */
.gift-control-panel .left-part-ctnr,
.anchor-lottery-entry,
.popular-main .lottery {
  display: none !important;
}
/* 兼容chrome 105以下版本 */
@supports not selector(:has(a, b)) {
  body:not(.player-full-win)[style*="overflow: hidden;"] {
  overflow-y: overlay !important;
  }
  .m-nobar__popup-container {
  display: none !important;
  }
}`;
    }
    if (this.config.menu.noDanmakuColor.enable) {
      cssText += `
.bili-danmaku-x-dm {
  color: #ffffff !important;
}`;
    }
    if (this.config.menu.noGameId.enable) {
      cssText += `
/* 总容器 */
.web-player-inject-wrap,
/* PK */
/* #pk-vm, */
/* #awesome-pk-vm, */
/* #chaos-pk-vm, */
/* 多人连麦 */
/* #multi-voice-index, */
/* #multi-player, */
/* 互动游戏 */
#game-id,
/* 连麦 */
#chat-control-panel-vm .voice-rtc,
/* 帮玩 */
#chat-control-panel-vm .play-together-service-card-container,
/* 一起玩 */
#chat-control-panel-vm .play-together-entry,
/* 神秘人 */
.chat-item .common-nickname-medal {
  display: none !important;
}`;
    }
    if (this.config.menu.rankInvisible.enable) {
      cssText += `
#aside-area-vm .privacy-dialog {
  display: none !important;
}`;
    }
    if (this.config.menu.noBBChat.enable) {
      cssText += `
/* 官方 */
#aside-area-vm #combo-card,
#aside-area-vm #combo-danmaku-vm,
#aside-area-vm .vote-card,
/* 自定义 */
.chat-item.NoVIP_chat_hide {
  display: none !important;
}`;
    }
    if (this.config.menu.noMirrorDanmaku.enable) {
      cssText += `
/* 屏蔽跨房聊天 */
.chat-item[data-isunilivedanmaku="true"] {
  display: none !important;
}
/* 屏蔽跨房弹幕 */
.bili-danmaku-x-dm[style*="--color: #fefefe"] {
  opacity: 0 !important;
}`;
    }
    if (this.config.menu.noBBDanmaku.enable) {
      cssText += `
/* 官方 */
.danmaku-item-container .bilibili-combo-danmaku-container,
.danmaku-item-container .combo {
  display: none !important;
}
/* 自定义 */
.bili-danmaku-x-dm.NoVIP_danmaku_hide,
/* 官方 */
.danmaku-item-container .mode-adv {
  opacity: 0 !important;
}`;
    }
    cssText += `
.chat-history-list.with-penury-gift.with-brush-prompt {
  height: calc(100% - ${height}px) !important;
}`;
    this.noRoomSkin();
    this.elmStyleCSS.innerHTML = cssText;
  }
  addUI(addedNode) {
    const elmUList = addedNode.firstElementChild;
    elmUList.childNodes.forEach(child => {
      if (child instanceof Comment) {
        child.remove();
      }
    });
    const listLength = elmUList.childElementCount;
    if (listLength > 10) {
      return;
    }
    const changeListener = (itemHTML, x) => {
      const itemSpan = itemHTML.querySelector('span');
      const itemInput = itemHTML.querySelector('input');
      itemInput.checked = this.config.menu[x].enable;
      itemInput.checked ? selectedCheckBox(itemSpan) : defaultCheckBox(itemSpan);
      itemInput.addEventListener('change', ev => {
        const evt = ev.target;
        evt.checked ? selectedCheckBox(itemSpan) : defaultCheckBox(itemSpan);
        this.config.menu[x].enable = evt.checked;
        GM_setValue('blnvConfig', encodeURI(JSON.stringify(this.config)));
        this.changeCSS();
      });
    };
    const selectedCheckBox = (spanClone) => {
      spanClone.classList.remove('checkbox-default');
      spanClone.classList.add('checkbox-selected');
    };
    const defaultCheckBox = (spanClone) => {
      spanClone.classList.remove('checkbox-selected');
      spanClone.classList.add('checkbox-default');
    };
    const itemHTML = elmUList.firstElementChild.cloneNode(true);
    const itemInput = itemHTML.querySelector('input');
    const itemLabel = itemHTML.querySelector('label');
    itemInput.id = itemInput.id.replace(/\d/, '');
    itemLabel.htmlFor = itemLabel.htmlFor.replace(/\d/, '');
    const listNodes = elmUList.childNodes;
    const replaceChild = [];
    for (const child of listNodes) {
      if (this.replaceMenu.has(child.innerText)) {
        replaceChild.push(child);
      }
    }
    replaceChild.forEach(child => child.remove());
    let i = listLength + 10;
    const itemFragment = document.createDocumentFragment();
    for (const x in this.config.menu) {
      const itemHTMLClone = itemHTML.cloneNode(true);
      const itemInputClone = itemHTMLClone.querySelector('input');
      const itemLabelClone = itemHTMLClone.querySelector('label');
      itemInputClone.id += i;
      itemLabelClone.htmlFor += i;
      i++;
      itemLabelClone.innerText = this.config.menu[x].name;
      changeListener(itemHTMLClone, x);
      itemFragment.appendChild(itemHTMLClone);
    }
    elmUList.appendChild(itemFragment);
  }
  addCSS() {
    GM_addStyle(`
/* 多行菜单 */
#chat-control-panel-vm .effectBlock[style*="width: 200px;"] {
  width: 270px !important;
}
#chat-control-panel-vm .control-panel-ctnr-new .effectBlock .arrow {
  left: 245px !important;
}
.block-effect-ctnr .item {
  float: left;
}
.block-effect-ctnr .item .cb-icon {
  left: unset !important;
  margin-left: -6px;
}
.block-effect-ctnr .item label {
  width: 84px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* 隐藏网页全屏榜单 */
.player-full-win .rank-list-section {
  display: none !important;
}
.player-full-win .chat-history-panel {
  height: calc(100% - 135px) !important;
}`);
  }
  async getRank(room_id, ruid) {
    const queryContributionRank = await fetch(this.queryRank(room_id, ruid, 'online_rank', 'contribution_rank'));
    const rank = await queryContributionRank.json();
    if (this.rankInvisible && rank?.data?.count > 150) {
      this.rankInvisible = false;
    }
    const item = rank?.data?.item;
    this.addUserInfo(item);
    this.addRank(room_id, ruid);
  }
  async addRank(room_id, ruid) {
    const types = [['online_rank', 'entry_time_rank'],
      ['daily_rank', 'today_rank'], ['daily_rank', 'yesterday_rank'],
      ['weekly_rank', 'current_week_rank'], ['weekly_rank', 'last_week_rank'],
      ['monthly_rank', 'current_month_rank'], ['monthly_rank', 'last_month_rank']];
    for (const type of types) {
      await Tools.sleep(5000);
      const queryContributionRank = await fetch(this.queryRank(room_id, ruid, type[0], type[1]));
      const rank = await queryContributionRank.json();
      const item = rank?.data?.item;
      this.addUserInfo(item);
    }
  }
  queryRank(room_id, ruid, type, switch_) {
    const url = `//api.live.bilibili.com/xlive/general-interface/v1/rank/queryContributionRank?\
ruid=${ruid}&room_id=${room_id}&page=1&page_size=100&type=${type}&switch=${switch_}&platform=web&web_location=444.8`;
    return Tools.querySign(url);
  }
  async addUserInfo(item) {
    if (this.userInfoDB === undefined) {
      this.userInfoDB = new DB('blnvUserInfo', 'userInfo', 'crc32');
      await this.userInfoDB.open([["uid", true], ["name", false]]);
    }
    item?.forEach(userInfo => {
      if (!userInfo.name.endsWith('***')) {
        this.userInfoDB.putData({ crc32: Tools.crc32(userInfo.uid), uid: userInfo.uid, name: userInfo.name });
      }
    });
  }
}
const noVIP = new NoVIP();
if (location.href.match(/^https:\/\/live\.bilibili\.com\/(?:blanc\/)?\d/) && document.documentElement.hasAttribute('lab-style')) {
  if (noVIP.config.menu.noActivityPlat.enable) {
    if (self === top) {
      if (location.pathname.startsWith('/blanc')) {
        history.replaceState(null, '', location.href.replace(`${location.origin}/blanc`, location.origin));
      }
      else {
        location.href = location.href.replace(location.origin, `${location.origin}/blanc`);
      }
    }
    else {
      top?.postMessage(location.origin + location.pathname, 'https://live.bilibili.com');
      top?.postMessage(location.origin + location.pathname, 'https://www.bilibili.com');
    }
  }
  noVIP.init();
  document.addEventListener('readystatechange', () => {
    if (document.readyState === 'complete') {
      noVIP.start();
    }
  });
}
else {
  if (noVIP.config.menu.noActivityPlat.enable) {
    W.addEventListener("message", msg => {
      if (msg.origin === 'https://live.bilibili.com' && msg.data.startsWith('https://live.bilibili.com/blanc/')) {
        location.href = msg.data;
      }
    });
  }
}