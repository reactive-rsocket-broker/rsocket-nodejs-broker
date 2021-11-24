// noinspection JSUnusedGlobalSymbols

const {RSocketServer} = require('rsocket-core');
const RSocketWebSocketServer = require('rsocket-websocket-server');
const {ReactiveSocket, Responder, Payload} = require("rsocket-types/build/ReactiveSocketTypes");
const {Single} = require('rsocket-flowable');
const {v4: uuidv4} = require('uuid');

/**
 * active connection
 * @type {Map<string, ReactiveSocket>}
 */
const CONNECTIONS = new Map();
/**
 * active apps
 * @type {Map<string, Object>}
 */
const APPS = new Map();

/**
 * request handler
 * @param requestingRSocket {ReactiveSocket}
 * @param setupPayload {Payload}
 * @return {Responder}
 */
const requestHandler = (requestingRSocket, setupPayload) => {
    // todo parse setup payload and inject request rsocket to global connections
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
    CONNECTIONS.set(connectionId, requestingRSocket);
    if (setupPayload.data) {
        const appMetadata = JSON.parse(setupPayload.data);
        appMetadata.uuid = connectionId;
        console.log("App", appMetadata);
        APPS.set(connectionId, appMetadata);
    }
    // rsocket responder
    return {
        requestResponse(payload) {
            // todo forward request to destination
            //const compositeMetadata = JSON.parse(payload.metadata );
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


