RSocket Node.js Broker
=======================

# 应用元信息

应用向Broker注册时，需要提供对应的元信息，如果是外部的设备接入，还需要提供接入的Token信息，请参考 https://github.com/rsocket/rsocket/blob/master/Extensions/Security/Authentication.md 

应用的元信息保存在setupPayload的data中，主要信息如下：

```json
{
  "ip": "192.168.1.1",
  "port": 8080,
  "name": "app-1",
  "owner": "leijuan",
  "services": [
    "com.example.logging.LoggingService"
  ],
  "startedAt": 1111111111111
}
```

# 服务调用路由规则

RSocket的服务调用主要是基于RSocket的服务路由规范，详情请参考 https://github.com/rsocket/rsocket/blob/master/Extensions/Routing.md

RSocket的路由规则是由多个Tags组成，第一个tag是服务名称，后续的tag都是辅助路由，比如调用指定节点的服务，格式如下即可：

```
com.example.logging.LoggingService
e=uuid
```

# References

* RSocket Flowable API: https://github.com/rsocket/rsocket-js/blob/master/docs/03-flowable-api.md
