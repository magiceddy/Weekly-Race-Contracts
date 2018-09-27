const WeeklyRace = artifacts.require('WeeklyRace.vyper');
const moment = require('moment');
const Promise = require("bluebird");

const undefBytes32 = '\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00';
const undefAddress = 0x0000000000000000000000000000000000000000;

if (typeof web3.eth.getAccountsPromise === "undefined") {
    Promise.promisifyAll(web3.eth, { suffix: "Promise" });
}

contract('WeeklyRace', (accounts) => {
    const
        owner = accounts[0],
        startDate = moment.utc('2018-10-27 00:00:00'),
        startTimestamp = startDate.format('X'),
        endTimestamp = startDate.clone().add(8, 'days').format('X'),
        betAmount = 1;

    describe('constructor', () => {

        describe('fail case', () => {
            it('should revert with value in transaction', async () => {
                try {
                    const instance = await WeeklyRace.new({ from: owner, value: betAmount });
                } catch (err) {
                    assert.include(
                        err.message,
                        'Cannot send value to non-payable constructor',
                        'no revert with value in transaction'
                    )
                }
            });
        });

        describe('success case', () => {
            it('should deploy the contract', async () => {
                try {
                    const instance = await WeeklyRace.new({ from: owner });
                    const contractOwner = await instance.owner();
                    assert.equal(contractOwner, owner, 'creator different from owner');
                } catch (err) {
                    assert.isUndefined(err.message, 'error in deploy with');
                }
            });
        });
    });

    describe('startNewRace', () => {
        let instance;

        beforeEach(async () => {
            instance = await WeeklyRace.new({ from: owner })
        });

        describe('fail case', () => {
            it('should revert with zero start', async () => {
                try {
                    await instance.startNewRace(0, endTimestamp, { from: owner });
                    assert.isUndefined(instance, 'no revert with zero start');
                } catch (err) {
                    assert.include(err.message, 'revert', 'no revert on zero start')
                }
            });

            it('should revert with undefined end', async () => {
                try {
                    await instance.startNewRace(startTimestamp, 0, { from: owner });
                    assert.isUndefined(instance, 'no revert with undefined end');
                } catch (err) {
                    assert.include(err.message, 'revert', 'no revert on undefined end')
                }
            });

            it('should revert with start lass than end', async () => {
                const previousEnd = startTimestamp - 1000;
                try {
                    await instance.startNewRace(startTimestamp, previousEnd, { from: owner });
                    assert.isUndefined(instance, 'no revert with previous end');
                } catch (err) {
                    assert.include(err.message, 'revert', 'no revert on previous end')
                }
            });

            it('should revert with start lass than actual time', async () => {
                const start = moment().format('X');
                const end = moment().add(1, 'days').format('X');
                const deltaDays = 60 * 60 * 24; // 1 day

                // increase time on testRPC
                await web3.currentProvider.send({ jsonrpc: "2.0", method: "evm_increaseTime", params: [deltaDays], id: 0 });
                await web3.currentProvider.send({ jsonrpc: "2.0", method: "evm_mine", params: [], id: 0 });

                try {
                    await instance.startNewRace(start, end, { from: owner });
                    assert.isUndefined(instance, 'no revert with previous start');
                } catch (err) {
                    assert.include(err.message, 'revert', 'no revert on previous start')
                }
            });

            it('should revert on sender different to owner', async () => {
                try {
                    await instance.startNewRace(startTimestamp, endTimestamp, { from: accounts[1] });
                    assert.isUndefined(instance, 'no revert with different owner');
                } catch (err) {
                    assert.include(err.message, 'revert', 'no revert on different owner')
                }
            });

            it('should revert with value in transaction', async () => {
                try {
                    const txObject = await instance.startNewRace(startTimestamp, endTimestamp, { from: owner, value: betAmount });
                    assert.isUndefined(txObject, 'no revert with value in transaction');
                } catch (err) {
                    assert.include(
                        err.message,
                        'Cannot send value to non-payable function',
                        'no revert with value in transaction'
                    )
                }
            });
        });

        describe('success case', async () => {
            let txObject;

            beforeEach(
                async () => {
                    txObject = await instance.startNewRace(startTimestamp, endTimestamp, { from: owner });
                });

            it('should log NewRace', async () => {
                const { logs } = txObject;
                const logStart = logs[0].args._start.toString(10);
                const logEnd = logs[0].args._end.toString(10);
                const logIndex = logs[0].args._raceID.toString(10);
                const nextIndex = await instance.nextRaceIndex();

                assert.equal(logStart, startTimestamp, 'log wrong start');
                assert.equal(logEnd, endTimestamp, 'log wrong end');
                assert.equal(logIndex, nextIndex.toNumber() - 1, 'log wrong index');
            });

            it('should set the state', async () => {
                const nextIndex = await instance.nextRaceIndex();
                const actualIndex = nextIndex.toNumber() - 1;
                const actualRaceStart = await instance.races__start(actualIndex);
                const actualRaceEnd = await instance.races__end(actualIndex);

                assert.equal(
                    actualRaceStart.toString(10), startTimestamp,
                    'save in state wrong start'
                );
                assert.equal(
                    actualRaceEnd.toString(10), endTimestamp,
                    'save in state wrong end'
                );
            });
        });
    });

    describe('registerRacerBet', () => {
        const
            tokens = ['ZRX', 'BNT', 'KYC'],
            tokenString = tokens.toString(),
            tokensHash = web3.sha3(tokenString),
            racer = accounts[1];
        let instance;

        beforeEach(async () => {
            instance = await WeeklyRace.new({ from: owner })
        });

        describe('fail case', () => {
            describe('no race registered', () => {
                it('should fail if no race was registered', async () => {
                    try {
                        const txObject = await instance.registerRacerBet(tokensHash, 0, { from: racer, value: betAmount });
                        assert.isUndefined(txObject, 'let user bet without game registered');
                    } catch (err) {
                        assert.include(err.message, 'revert', 'no revert if no race was registered')
                    }
                });
            });

            describe('race registered', () => {
                let raceID, nextRaceIndex;

                beforeEach(async () => {
                    await instance.startNewRace(startTimestamp, endTimestamp, { from: owner });
                    nextRaceIndex = await instance.nextRaceIndex();
                    raceID = nextRaceIndex.toNumber() - 1;
                });

                it('should fail if sender is owner', async () => {
                    try {
                        const txObject = await instance.registerRacerBet(tokensHash, 0, { from: owner, value: betAmount });
                        assert.isUndefined(txObject, 'let owner to bet');
                    } catch (err) {
                        assert.include(err.message, 'revert', 'no revert if sender is the owner');

                    }
                });

                it('should fail with undefined hashBet', async () => {
                    try {
                        const txObject = await instance.registerRacerBet(undefBytes32, raceID, { from: racer, value: betAmount });
                        assert.isUndefined(txObject, 'let user bet without defined bet');
                    } catch (err) {
                        assert.include(err.message, 'revert', 'no revert with undefined bet');

                    }
                });

                it('should revert with race id equals or more than nextRaceId', async () => {
                    try {
                        const txObject = await instance.registerRacerBet(tokensHash, nextRaceIndex, { from: racer, value: betAmount });
                        assert.isUndefined(txObject, 'user can bet on unregister race');
                    } catch (err) {
                        assert.include(err.message, 'revert', 'no revert with future raceID');
                    }
                });

                it('should revert with zero value', async () => {
                    try {
                        const txObject = await instance.registerRacerBet(tokensHash, raceID, { from: racer });
                        assert.isUndefined(txObject, 'user can bet without pay');
                    } catch (err) {
                        assert.include(err.message, 'revert', 'no revert without value in transaction');
                    }
                });

                it('should revert if racer has already bet', async () => {
                    await instance.registerRacerBet(tokensHash, raceID, { from: racer, value: betAmount });

                    try {
                        const txObject = await instance.registerRacerBet(tokensHash, raceID, { from: racer, value: betAmount });
                        assert.isUndefined(txObject, 'player can bet more times');
                    } catch (err) {
                        assert.include(err.message, 'revert', 'no revert on double bet');
                    }
                });

                it('should revert if game is already started', async () => {
                    const deltaDay = 60 * 60 * 24; // 1 day
                    const currentBlock = await web3.eth.getBlock('latest');
                    const blockTimeStamp = currentBlock.timestamp;


                    const currentBlockTimeInDate = moment.unix(blockTimeStamp);
                    const deltaStartRaceFromCurrentBlockTimeInSeconds = startDate.diff(currentBlockTimeInDate, 'seconds');
                    const moveOneDayAfterStart = deltaStartRaceFromCurrentBlockTimeInSeconds + deltaDay;

                    // increase time on testRPC
                    await web3.currentProvider.send({ jsonrpc: "2.0", method: "evm_increaseTime", params: [moveOneDayAfterStart], id: 0 });
                    await web3.currentProvider.send({ jsonrpc: "2.0", method: "evm_mine", params: [], id: 0 });

                    try {
                        const txObject = await instance.registerRacerBet(tokensHash, raceID, { from: racer, value: betAmount });
                        assert.isUndefined(txObject, 'user can on started race');
                    } catch (err) {
                        assert.include(err.message, 'revert', 'no revert betting on started race');
                    }
                });
            });
        });

        describe('success case', () => {
            const
                startDate = moment.utc('2018-10-29 00:00:00'),
                startTimestamp = startDate.format('X'),
                endTimestamp = startDate.clone().add(8, 'days').format('X');
            let raceID, nextRaceIndex;

            it('should log NewUserBet', async () => {
                await instance.startNewRace(startTimestamp, endTimestamp, { from: owner });

                nextRaceIndex = await instance.nextRaceIndex();
                raceID = nextRaceIndex.toNumber() - 1;

                const txObject = await instance.registerRacerBet(tokensHash, raceID, { from: racer, value: betAmount });
                const { logs } = txObject;

                assert.equal(logs[0].args._raceID, raceID, 'log wrong raceID');
                assert.equal(logs[0].args._racer, racer, 'log wrong racer');
                assert.equal(logs[0].args._tokensHashBet, tokensHash, 'log wrong hash bet');
                assert.equal(logs[0].args._betAmount, betAmount, 'log wrong bet amount');
            });

            // it('should set the state', async () => {
            //     console.log(racer);
            //     const currentHashBet = await instance.races__racersBetHash.call(0, '0xf17f52151ebef6c7334fad080c5704d77216b732');
            //     console.log(currentHashBet);
            // });
        });
    });
});
