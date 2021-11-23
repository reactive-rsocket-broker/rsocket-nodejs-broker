const {RSocketServer, CompositeMetadata} = require('rsocket-core');
const RSocketWebSocketServer = require('rsocket-websocket-server');
const {Single} = require('rsocket-flowable');
const {v4: uuidv4} = require('uuid');

// active rsocket connections
const CONNECTIONS = new Map();
const APPS = new Map();

const requestHandler = (requestingRSocket, setupPayload) => {
    // todo parse setup payload and inject request rsocket to global connections
    //const compositeMetadata = new CompositeMetadata(setupPayload.metadata );
    let connectionId = uuidv4();
    // rsocket connection status subscribe
    requestingRSocket.connectionStatus().subscribe({
        onNext: status => {
            if (status.kind === 'CLOSED' || status.kind === 'ERROR') {
                console.log("App closed", APPS.get(connectionId));
                CONNECTIONS.delete(connectionId);
                APPS.delete(connectionId);
            }
        },
        onSubscribe: subscription => subscription.request(Number.MAX_SAFE_INTEGER)
    });
    // metadata push
    requestingRSocket.metadataPush({metadata: JSON.stringify({uuid: connectionId})}).subscribe();
    // add to connections
    requestingRSocket.uuid = connectionId;
    CONNECTIONS.set(connectionId, requestingRSocket);
    if (setupPayload.data) {
        const appMetadata = JSON.parse(setupPayload.data);
        console.log("App", appMetadata);
        APPS.set(connectionId, appMetadata);
    }
    // rsocket responder
    return {
        requestResponse(payload) {
            // todo forward request to destination
            //const compositeMetadata = new CompositeMetadata(payload.metadata );
            return Single.of({
                data: "Hello " + payload.data
            });
        },
        metadataPush(payload) {
            return Single.of({});
        },
    };
};

const WebSocketServerTransport = RSocketWebSocketServer.default;
const transport = new WebSocketServerTransport({host: "127.0.0.1", port: 42252});
const rsocketServer = new RSocketServer({transport: transport, getRequestHandler: requestHandler});
rsocketServer.start();


