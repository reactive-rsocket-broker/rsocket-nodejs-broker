const RSocketWebSocketClient = require('rsocket-websocket-client').default;
const {RSocketClient} = require("rsocket-core");
const WebSocket = require('ws');
const {Single} = require("rsocket-flowable");

const appMetadata = {ip: '192.168.1.1', port: 8181, name: 'rsocket-app1'};

const rsocketClient = new RSocketClient({
    setup: {
        keepAlive: 1000000,
        lifetime: 100000,
        metadataMimeType: 'application/json',
        dataMimeType: 'application/json',
        payload: {
            data: JSON.stringify(appMetadata),
            metadata: JSON.stringify({token: '12345'})
        }
    },
    transport: new RSocketWebSocketClient(
        {
            debug: true,
            url: 'ws://localhost:42252',
            wsCreator: url => new WebSocket(url)
        }
    ),
    responder: {
        requestResponse(payload) {
            return Single.of({
                data: "xxx"
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

monoRSocket.then(rsocket => {
    rsocket.requestResponse({
        data: JSON.stringify({fileName: 'demo.log', offset: 0, length: 100}),
        metadata: JSON.stringify(
            {
                "message/x.rsocket.routing.v0": [
                    "com.example.logging.LoggingService.getLog",
                    "e=uuid"
                ]
            }
        )
    }).subscribe({
        onComplete: (payload) => console.log(payload),
        onError: error => {
            console.error(error);
        },
    });
});


