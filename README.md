# Benchmark Contracts with monitoring

This contract system is developed for TON blockchain stress-testing and optimization 
of transactions per second performance. When TPS exceeds some values, it
becomes impossible to count it off-chain in ways like indexers, because
they use databases that are not as fast as TON. Thanks to powerful smart-contract system
TON can act as a database itself and through special set of contracts count TPS load.

To optimize performance for real life usage it is important that load created by benchmark
is similiar to that characteristic for Dapps.

In this system, one type of contract called _Retranslator_ implements logic similar to [jettons](https://github.com/ton-blockchain/TEPs/blob/master/text/0074-jettons-standard.md) plus some functionality of
[wallets](https://ton-community.github.io/tutorials/01-wallet/). Thus main load created
by this benchmark is analogous to chained jetton transfers. 
Every few such transfers (or *hops*), a report is sent to
one of intermediate _Counter Contracts_ located in basechain.
And _Counter Contracts_, in turn, from time to time, sends reports to the _Master
Counter Contract_ every few seconds which resides in masterchain.
_Master Counter Contract_ saves the results to the _history_ - hashmap with _timestamp -> TPS_ data.

**This contract system allows to trustlessly monitor TPS load created in all shardchains
by verifying only Masterchain and polling one contract get method**

### Detailed description in code:

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
-   `counter_calc_tries_per_hop` [in retranslator.fc](contracts/retranslator.fc#L20) -
    the number of tries to calculate the next counter in the same shard during a hop.
    If exceeds - uses the last calculated one (i.e. random counter).
-   `retranslator_calc_tries_limit` [in retranslator.fc](contracts/retranslator.fc#L21) -
    the maximum number of tries to calculate the shard of the next retranslator.
    If exceeds - uses itself for the next hop.
-   `monkey_mode` [in retranslator.fc](contracts/retranslator.fc#L18) - if
    set to -1 (true), the system will switch to the mode when the
    retranslator self-destructs after the hop. This is designed to test
    behavior under reduced state change per tx in the block:
    if contract goes uninit-\>uninit, instead of uninit-\>init block proof doesn't
    need to contain merkle tree of state update (note that even if contract storage
    is unchanged, for existing account update of `last_lt`/`last_hash` causes state
    update)
-   `master_report_timestep` [in utils.fc](contracts/imports/utils.fc#L3) -
    the time required to pass for a Counter to report again to master.
-   `count_report_as_tx` [in counter.fc](contracts/counter.fc#L18) - if
    set to -1 (true), counter will count the message from the retranslator
    as hop.
-   `history_step` [in
    master\_counter.fc](contracts/master_counter.fc#L13) - the
    discreteness with which transactions will be written in the history
    dictionary.

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
-   `txs_per_report` - frequency of reports, or how rarely retranslator
    will report to counter.
-   `sameShardProbability` - the chance that when the retranslator is
    called, the next hop will be in its shard. It is used to regulate the
    load between shards or for tests of a single shard.
-   `extraDataSizeBytesOrRef` - you can add extra data for every hop
    message. For this, set it ot a number of bytes to add, or to
    a reference cell, which will be added to the message.
