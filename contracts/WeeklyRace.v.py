# @dev Emits when new weekly race has been created
# @params _start Date starting race
# @params _end Date ending race
# @params _raceID Race index inside races array
NewRace: event({
    _start: indexed(timestamp),
    _end: indexed(timestamp),
    _raceID: indexed(int128)
})

# @dev Emits when a racer bet on a weekly race
# @params _raceID Race index inside races array
# @params _tokensHashBet Hash of the bet
# @parmas _betAmount Represent the amount of ... betted
NewUserBet: event({
    _raceID: indexed(int128),
    _racer: indexed(address),
    _tokensHashBet: bytes32,
    _betAmount: indexed(wei_value)
})

# contract Owner
owner: public(address)

# next raceID
nextRaceIndex: public(int128)

# Array of all races
races: public({
    start: timestamp,
    end: timestamp,
    racersBetHash: bytes32[address],
    racersBetAmount: wei_value[address]
}[int128])

# @dev Check if sender is the owner of the contract
# @params _sender Sender's address
# @return bool True if _sender is the owner, false otherwise


@private
def fromOwner(_sender: address) -> bool:
    return _sender == self.owner

# @dev Contract constructor


@public
def __init__():
    self.owner = msg.sender

# @dev Owner's public function to start a race
# @params _start Date starting race
# @params _end Date ending race
# @return raceID of newly created race


@public
def startNewRace(_start: timestamp, _end: timestamp) -> int128:
    assert _start < _end
    assert _start > block.timestamp
    assert self.fromOwner(msg.sender)

    raceID: int128 = self.nextRaceIndex

    self.races[raceID].start = _start
    self.races[raceID].end = _end

    self.nextRaceIndex = raceID + 1

    log.NewRace(self.races[raceID].start, self.races[raceID].end, raceID)
    return raceID

# @dev Racer's public function to submit his bet
# @params _tokensHash Hash representing the racer bet.
#                     e.g. sha3(['ZRX', 'BNC', ...])
# @params _raceID ID of the race betting on


@public
@payable
def registerRacerBet(_tokensHash: bytes32, _raceID: int128) -> bool:
    assert not self.fromOwner(msg.sender)
    assert not not self.nextRaceIndex
    assert not not _tokensHash
    assert not not msg.value
    assert self.races[_raceID].start > block.timestamp
    assert not self.races[_raceID].racersBetHash[msg.sender]
    # TODO implement conversion from ETH to Token
    # now the contract has X DAI in name of the sender

    betInToken: wei_value = msg.value
    self.races[_raceID].racersBetAmount[msg.sender] = betInToken
    self.races[_raceID].racersBetHash[msg.sender] = _tokensHash

    log.NewUserBet(_raceID, msg.sender,
                   self.races[_raceID].racersBetHash[msg.sender],
                   self.races[_raceID].racersBetAmount[msg.sender])
    return True
