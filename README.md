# Benchmark Contracts with monitoring

> ⚠️ Currently, to run in _ownnet_ (MyLocalTon) or in _Perfnet_, use
> [Blueprint from PR #65](https://github.com/ton-org/blueprint/pull/65)

This contract system is needed to test the TON blockchain for the maximum
number of transactions per second. When TPS exceeds some values, it
becomes difficult to count it off-chain in ways like indexers, because
they use databases that are not as fast as TON.

In this system, one type of contract called _Retranslator_ works a bit
like
[jettons](https://github.com/ton-blockchain/TEPs/blob/master/text/0074-jettons-standard.md)
and a bit like
[wallets](https://ton-community.github.io/tutorials/01-wallet/), but
cyclically calling its copies. Every few such hops, a report is sent to
the _Counter Contract_, of which there are also several and which are
located in basechain. And _Counter Contracts_ send reports to the _Master
Counter Contract_ every few seconds. And this one also saves the results
to the _history_ - hashmap, where each second corresponds to the number of
transactions.

## How to use

### Build contracts

`yarn build`

### Run smoke test

> You can play with settings in it (tests/SmokeBench.spec.ts)

`yarn test`

### Deploy the system and start

`yarn blueprint run deployAllAndStart`

### Start another spam afer deploy

`yarn blueprint run startSpam`
