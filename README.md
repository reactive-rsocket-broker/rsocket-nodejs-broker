RSocket Node.js Broker
=======================


# 服务调用路由规则

RSocket的服务调用主要是基于RSocket的服务路由规范，详情请参考 https://github.com/rsocket/rsocket/blob/master/Extensions/Routing.md

RSocket的路由规则是由多个Tags组成，第一个tag是服务名称，后续的tag都是辅助路由，比如调用指定节点的服务，格式如下即可：
```
com.example.logging.LoggingService
e=uuid
```

# References

* RSocket Flowable API: https://github.com/rsocket/rsocket-js/blob/master/docs/03-flowable-api.md
