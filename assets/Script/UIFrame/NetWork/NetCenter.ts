import { ISocket, IMsg } from "./NetInterface";

enum SocketState {
    Closed,             // 已关闭
    Connecting,         // 连接中
    Connected,          // 已连接
}

enum RequestState {
    requesting,
    responsed,
}

type connectOption = string | {ip: string, port: number, protocol: string};
/** 
 * 网络中心服务
 * 
 * 连接网络, 重连
 * 
 */
export default class NetCenter {
    
    private state : SocketState = SocketState.Closed;                  // 状态
    private socket: ISocket;                                // socket

    /** 连接网络相关 */
    private connectOption : connectOption;                   // 连接参数
    private reconnectTimes: number = 0;                      // 重连次数 -1表示一直重连， 0表示不重连， 其他为重连次数
    /**  */
    private eventHandlers : {[key: number]: Array<EventHandler>} = {};


    /** 初始化NetCenter */
    public init(socket: ISocket, connectOption: connectOption, reconnectTimes: number) {
        this.socket = socket;
        this.connectOption = connectOption;     
        this.reconnectTimes = reconnectTimes;
        this.addEventToSocket();
    }

    /** 连接网络 */
    public connect() {
        if(this.socket && this.state === SocketState.Closed) {
            this.socket.connect(this.connectOption);
        }
        this.state = SocketState.Connecting;   // 连接中
    }

    /** 添加监听事件 */
    public addEventToSocket() {
        let self = this;
        /** 连接成功 */
        this.socket.onConnect = function(e) {
            cc.log('连接网络成功!');
            self.state = SocketState.Connected;
            // GEventManager.emit('NetWork_Connect', null);
        }
        /** 收到消息 */
        this.socket.onMessage = function(msg: {cmd: number, data: any}) {
            let arr = self.eventHandlers[msg.cmd];
            if(!arr) {
                cc.log(`收到一个未知命令:${msg.cmd}`);
                return ;
            }
            for(const e of arr) {
                e && e.callback.call(e.target, msg.data);
            }
        }
        /** 连接被关闭 */
        this.socket.onClose = function(e) {
            if(self.reconnectTimes < 0) {
                self.connect();
                return ;
            }
            if(self.reconnectTimes === 0) {
                cc.log(`连接关闭！`);
                return ;
            }
            self.reconnectTimes --;
            self.connect();
        }

        this.socket.onError = function(e) {
            cc.log(`网络错误！`);
        }
    }

    /** 发送数据 */
    public send(msg: IMsg) {
        if(this.state !== SocketState.Connected) {
            cc.log('网络未连接！无法发送数据');
            return false;
        }
        return this.socket.send(msg);
    }
    /** 带回调的请求 */
    public request(msg: IMsg, callback: Function, target?: Object) {
        this.onEventHandler(msg.cmd, callback, target);
        this.send(msg);

    }



    /** 事件句柄 */
    public onEventHandler(cmd: number, callback: Function, target: Object) {
        if(!this.eventHandlers[cmd]) {
            this.eventHandlers[cmd] = [];
        }
        this.eventHandlers[cmd].push(new EventHandler(callback, target));
    }
    /** 监听一次，收到该事件则取消监听 */
    public onceEventHandler(cmd: number, callback: Function, target: Object) {
        
    }
    public offEventHandler(cmd: number, callback: Function, target: Object) {
        let arr = this.eventHandlers[cmd];
        if(!arr) {
            cc.log(`没有这个命令${cmd}，请注意`);
            return ;
        }
        for(let i=arr.length-1; i>=0; i--) {
            if(arr[i] && arr[i].callback === callback && arr[i].target === target) {
                arr.splice(i, 1);
            }
        }
        if(arr.length === 0) {
            this.clearEventHandler[cmd];
        }
    }
    public clearEventHandler(cmd: number) {
        if(!this.eventHandlers[cmd]) {
            return ;
        }
        this.eventHandlers[cmd] = null;
        delete this.eventHandlers[cmd];
    }
}

/**  */
class EventHandler {
    callback: Function;
    target: Object;

    constructor(callback: Function, target: Object) {
        this.callback = callback;
        this.target = target;
    }
}