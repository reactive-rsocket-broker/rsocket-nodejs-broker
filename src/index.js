// noinspection JSUnusedGlobalSymbols

const {RSocketServer, MESSAGE_RSOCKET_ROUTING} = require('rsocket-core');
const WebSocketServerTransport = require('rsocket-websocket-server').default;
const {ReactiveSocket, Responder, Payload} = require("rsocket-types/build/ReactiveSocketTypes");
const {Single, Flowable} = require('rsocket-flowable');
const {v4: uuidv4} = require('uuid');
const Multimap = require('multimap');
const random = require('random')

/**
 * active connections
 * @type {Map<string, ReactiveSocket>}
 */
const CONNECTIONS = new Map();
/**
 * active apps
 * @type {Map<string, AppMetadata>}
 */
const APPS = new Map();
/**
 * service registry
 * @type {Multimap<string,string>}
 */
const SERVICES = new Multimap();

/**
 * parse composite metadata json text to object
 * @type {string} composite metadata json text
 * @return {Object}
 */
function parseCompositeMetadata(compositeMetadata) {
    if (!compositeMetadata) return {};
    try {
        if (compositeMetadata.indexOf('{') > 0) {
            compositeMetadata = compositeMetadata.substring(compositeMetadata.indexOf('{'));
        }
        const result = JSON.parse(compositeMetadata);
        if (typeof result !== 'object') {
            return {};
        }
        return result;
    } catch (e) {
        return {};
    }
}

/**
 * RSocket Response Handler for App
 * @extends Responder
 */
class RSocketBrokerRespondHandler {
    /**
     * @param {ReactiveSocket} requestingRSocket request rsocket
     * @param {string} appId app id
     */
    constructor(requestingRSocket, appId) {
        this.requestingRSocket = requestingRSocket;
        this.appId = appId;
    }

    requestResponse(payload) {
        const compositeMetadata = parseCompositeMetadata(payload.metadata);
        /**@type {string[]} */
        const rsocketRouting = compositeMetadata[MESSAGE_RSOCKET_ROUTING._string];
        // health check
        if (rsocketRouting && rsocketRouting.length > 0 && rsocketRouting[0] === "ping") {
            return Single.of({
                data: '{"status":"UP"}',
            });
        }
        let destinationRSocket = findDestination(compositeMetadata);
        if (destinationRSocket) {
            return destinationRSocket.requestResponse(payload);
        } else {
            return Single.error(new Error("APPLICATION_ERROR: no destination found"));
        }
    }

    fireAndForget(payload) {
        const compositeMetadata = parseCompositeMetadata(payload.metadata);
        let destinationRSocket = findDestination(compositeMetadata);
        if (destinationRSocket) {
            destinationRSocket.fireAndForget(payload);
        }
    }

    requestStream(payload) {
        const compositeMetadata = parseCompositeMetadata(payload.metadata);
        let destinationRSocket = findDestination(compositeMetadata);
        if (destinationRSocket) {
            return destinationRSocket.requestStream(payload);
        } else {
            return Flowable.error(new Error("APPLICATION_ERROR: no destination found"));
        }
    }

    metadataPush(payload) {
        const compositeMetadata = parseCompositeMetadata(payload.metadata);
        if (Object.keys(compositeMetadata).length > 0) {
            //logic process, such as unregister
            console.log('metadataPush', payload.metadata);
        }
        return new Single(subscriber => {
            subscriber.onSubscribe();
            subscriber.onComplete(undefined);
        });
    }

    requestChannel(payloads) {
        return Flowable.error(new Error("APPLICATION_ERROR: not implemented"));
    }

}

/**
 * find destination RSocket
 * @param {Object} compositeMetadata
 * @return {ReactiveSocket|undefined}
 */
function findDestination(compositeMetadata) {
    let destinationRSocket = undefined;
    /**@type {string[]} */
    let rsocketRouting = compositeMetadata[MESSAGE_RSOCKET_ROUTING._string];
    if (rsocketRouting) {
        let destinationUUID = undefined;
        if (rsocketRouting.length > 1 && rsocketRouting[1].startsWith("e=")) { // routing by endpoint UUID
            destinationUUID = rsocketRouting[1].substring(2);
            destinationRSocket = CONNECTIONS.get(destinationUUID);
        } else { // routing by service name
            const routingKey = rsocketRouting[0];
            const serviceName = routingKey.indexOf(".") > 0 ? routingKey.substring(0, routingKey.lastIndexOf('.')) : routingKey;
            const destinations = SERVICES.get(serviceName);
            if (destinations && destinations.length > 0) {
                let destinationUUID;
                if (destinations.length === 1) {
                    destinationUUID = destinations[0];
                } else {
                    destinationUUID = destinations[random.int(0, destinations.length - 1)];
                }
                destinationRSocket = CONNECTIONS.get(destinationUUID);
            }
        }
    }
    return destinationRSocket;
}

/**
 * rsocket broker request responder
 * @param requestingRSocket {ReactiveSocket}
 * @param setupPayload {Payload}
 * @return {RSocketBrokerRespondHandler}
 */
const brokerRequestHandler = (requestingRSocket, setupPayload) => {
    let connectionId = uuidv4();
    /** @type {AppMetadata|undefined} */
    let appMetadata = undefined;
    if (setupPayload.data) {
        appMetadata = parseCompositeMetadata(setupPayload.data);
    }
    // validate app metadata
    if (appMetadata) {
        appMetadata.uuid = connectionId;
        appMetadata.createdAt = new Date();
        console.log("App registered", appMetadata);
        //register app
        CONNECTIONS.set(connectionId, requestingRSocket);
        APPS.set(connectionId, appMetadata);
        //register services
        const appServices = appMetadata.services;
        if (appServices && appServices.length > 0) {
            appServices.forEach(service => {
                console.log(`Service registered: ${service} @ ${connectionId} from ${appMetadata.name}`);
                SERVICES.set(service, appMetadata.uuid);
            });
        }
    } else {
        requestingRSocket.close();
        return {};
    }
    // rsocket connection status subscribe
    requestingRSocket.connectionStatus().subscribe({
        onNext: status => {
            if (status.kind === 'CLOSED' || status.kind === 'ERROR') {
                let appMetadata = APPS.get(connectionId);
                //unregister connection
                CONNECTIONS.delete(connectionId);
                if (appMetadata) {
                    console.log("App closed", appMetadata);
                    APPS.delete(connectionId);
                    //unregister services from registry
                    if (appMetadata.services) {
                        appMetadata.services.forEach(service => {
                            SERVICES.delete(service, appMetadata.uuid);
                        });
                    }
                }
            }
        },
        onSubscribe: subscription => subscription.request(Number.MAX_SAFE_INTEGER)
    });
    // metadata push: uuid information to app
    requestingRSocket.metadataPush({metadata: JSON.stringify({uuid: connectionId})}).subscribe();
    // RSocket responder
    return new RSocketBrokerRespondHandler(requestingRSocket, connectionId);
};


/**
 * rsocket OPS request responder
 * @param _requestingRSocket {ReactiveSocket}
 * @param _setupPayload {Payload}
 * @return {Responder}
 */
const opsRequestHandler = (_requestingRSocket, _setupPayload) => {
    return {
        requestResponse(_payload) {
            return Single.of({
                data: JSON.stringify(Object.fromEntries(APPS))
            });
        }
    };
};

function startRSocketServer(port, requestHandler, hint) {
    const transportServer = new WebSocketServerTransport({host: "0.0.0.0", port: port});
    const serverConfig = {transport: transportServer, getRequestHandler: requestHandler};
    const rsocketServer = new RSocketServer(serverConfig);
    rsocketServer.start();
    console.log(`RSocket Server started on ${port}: ${hint}`);
}

// start RSocket Broker
startRSocketServer(42252, brokerRequestHandler, "RSocket Broker Server");
// start Ops Server
startRSocketServer(42253, opsRequestHandler, "RSocket Ops Server");

/**
 * AppMetadata
 * @typedef {Object} AppMetadata
 * @property {string} uuid - connection id
 * @property {string} name - app name
 * @property {Date} createdAt - created timestamp
 * @property {string[]} services - exposed services
 */

