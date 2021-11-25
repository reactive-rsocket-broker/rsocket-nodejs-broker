const RSocketWebSocketClient = require('rsocket-websocket-client').default;
const {RSocketClient, APPLICATION_JSON} = require("rsocket-core");
const WebSocket = require('ws');
const {Single} = require("rsocket-flowable");

const BROKER_URL = "ws://localhost:42252";
const appMetadata = {ip: '192.168.1.2', name: 'rsocket-app2', services: ['com.example.UserService']};

const rsocketClient = new RSocketClient({
    setup: {
        keepAlive: 300_000, //send keepalive every 5 minutes
        lifetime: 2147483647, //disable keepalive respond timeout
        metadataMimeType: APPLICATION_JSON._string,
        dataMimeType: APPLICATION_JSON._string,
        payload: {
            data: JSON.stringify(appMetadata)
        }
    },
    transport: new RSocketWebSocketClient(
        {
            debug: true,
            url: BROKER_URL,
            wsCreator: (url) => new WebSocket(url)
        }
    ),
    responder: {
        requestResponse(payload) {
            return Single.of({
                data: JSON.stringify({id: 1, name: 'John Doe'}),
            })
        },
        fireAndForget(payload) {
            console.log('fireAndForget', payload.data);
        },
        metadataPush(payload) {
            if (payload.metadata) {
                console.log('metadataPush', payload.metadata);
                appMetadata.uuid = JSON.parse(payload.metadata).uuid;
            }
            return Single.of({});
        },
    }
});

const monoRSocket = rsocketClient.connect();

monoRSocket.then(_rsocket => {
    console.log(`Node.js RSocket Service started and connected with ${BROKER_URL}`);
});


