# Benchmark Contracts with monitoring

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

#### Detailed description in code:

-   [Retranslator](contracts/counter.fc)
-   [Counter](contracts/counter.fc)
-   [Master Counter](contracts/counter.fc)


## Usage

> ⚠️ Currently, to run in _ownnet_ (MyLocalTon) or in _Perfnet_, use
> [Blueprint from PR #65](https://github.com/ton-org/blueprint/pull/65)

### Deploy and start

`yarn blueprint run deployAllAndStart`

This will generate a keypair for system (or read an existing one), deploy
a Master Counter, will topup the first Retranslator and send an external
message to it for start. Then you should see a TPS monitor.

> Master Counter needs some coins for history calculations. We recommend
> you topup it with 100 TONs for ~10000 hops.

### Start spam afer deploy

`yarn blueprint run startSpam [retranslator-addr]`

This will ask you for an address of a Retranslator you want to start from.
Then it should automaticaly parse its id, topup or ask you for a topup,
and send an external message to start.

### Monitor TPS from a Master Counter

`yarn blueprint run monitorTPS [master-addr]`

This will ask you for an address and show the average TPS monitor. Will
turn of in a minute if there is no txs on the Master Counter.

### Withdraw unused coins

`yarn blueprint run withdraw [from-addr] [dest-addr]`

Ended your tests? This will help you send all the coins from
a Retranslator or Master Counter just as from a simple wallet.

### Run locally

`yarn test`

This will deploy everything, run a test spam and print a nice table of
resulting transactions. You can play with settings in
[SmokeBench.spec.ts](tests/SmokeBench.spec.ts#L18-L24).


## Configuration

Here are the parameters you may change for benchmarking:

##### In code:

-   `max_retranslators` [in
    retranslator.fc](contracts/retranslator.fc#L19) - the maximum number
    of retranslator id. Roughly, how much retranslators to use.
-   `max_counters` [in retranslator.fc](contracts/retranslator.fc#L20)
    - the maximum number of counter. id. Making it large will sometimes
      decrease the frequency of reports to the master counter.
-   `monkey_mode` [in retranslator.fc](contracts/retranslator.fc#L18) - if
    set to -1 (true), the system will switch to the mode when the
    retranslator self-destructs after the hop. This is designed to reduce
    the state change in the block (the contract will be uninit-\>uninit,
    instead of uninit-\>init), reduce the cost and increase TPS.
-   `txs_per_report` [in utils.fc](contracts/imports/utils.fc#L7) - how
    much txs a counter will add when receiving a report from retranslator.
-   `master_report_timestep` [in utils.fc](contracts/imports/utils.fc#L3)
    - the time required to pass for a Counter to report again to master.
-   `count_report_as_tx` [in counter.fc](contracts/counter.fc#L18) - if
    set to -1 (true), counter will count the message from the retranslator
    as hop.

##### On start, in external:

This parameters are different for every run, may be changed in _scripts_
and _tests_, see [startSpam.ts](scripts/startSpam.ts#L6-L12),
[deployAllAndStart.ts](scripts/deployAllAndStart.ts#L7-L13) and
[SmokeBench.spec.ts](tests/SmokeBench.spec.ts#L18-L24).

-   `amount` - TONs for every thread, consumption: < 50 TON per 1000 hops.
-   `hops` - the amount of hops.
-   `threads` - default is 1. if > 1, the effect is identical to running
    1 thread multiple times on retranslator.
-   `splitHops` - when a split occurs, the stream is divided into two such
    streams, which would have come out if there had been no split, but their
    amount becomes half as much. the split always occurs at the beginning of
    the chain. And if there are several splits, **each stream** that have
    turned out after the previous splits will be once again divided into
    two. So the number of threads is `2 ^ splitHops`. For example,
    2 `splitHops` will give 4 threads, 3 will give 8, 4 will give 16, etc.
-   `sameShardProbability` - the chance that when the retranslator is
    called, the next hop will be in its shard. It is used to regulate the
    load between shards or for tests of a single shard.
-   `extraDataSizeBytesOrRef` - you can add extra data for every hop
    message. For this, set it ot a number of bytes to add, or to
    a reference cell, which will be added to the message.

