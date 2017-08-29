var ModelRepository = artifacts.require('./ModelRepository.sol')

const hexToString = hexString => {
  return new Buffer(hexString.replace('0x', ''), 'hex').toString()
}

const splitIpfsHashInMiddle = ipfsHash => {
  return [
    ipfsHash.substring(0, 32),
    ipfsHash.substr(32) + '0'.repeat(18)
  ]
}

const twoPartIpfsHash = splitIpfsHashInMiddle('QmWmyoMoctfbAaiEs2G46gpeUmhqFRDW6KWo64y5r581Vz')

contract('ModelRepository', accounts => {
  const ulyssesTheUser = accounts[0]

  it('allows anyone to add a model', async () => {
    const bountyInWei = 10000
    const initialError = 42
    const targetError = 1337

    const modelRepositoryContract = await ModelRepository.deployed();
    await modelRepositoryContract.addModel(twoPartIpfsHash, initialError, targetError, {
      from: ulyssesTheUser,
      value: bountyInWei
    })

    const model = await modelRepositoryContract.getModel.call(0)
    assert.equal(model[0], ulyssesTheUser, 'owner persisted')
    assert.equal(model[1], bountyInWei, 'bounty persisted')
    assert.equal(model[2], initialError, 'initial_error persisted')
    assert.equal(model[3], targetError, 'target_error persisted')
    assert.equal(hexToString(model[4][0]), twoPartIpfsHash[0], 'ipfshash persisted')
    assert.equal(hexToString(model[4][1]), twoPartIpfsHash[1], 'ipfshash persisted')
  })

  it('allows anyone to add a gradient', async () => {
    const twoPartIpfsHash = splitIpfsHashInMiddle('QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG')
    const modelRepositoryContract = await ModelRepository.deployed();
    const modelId = 0
    await modelRepositoryContract.addGradient(modelId, twoPartIpfsHash, {
      from: ulyssesTheUser
    })

    const gradientId = 0
    const gradient = await modelRepositoryContract.getGradient.call(modelId, gradientId)

    assert.equal(gradient[0], gradientId, 'has an id')
    assert.equal(gradient[1], ulyssesTheUser, 'has a creator')
    assert.equal(hexToString(gradient[2][0]), twoPartIpfsHash[0], 'ipfshash persisted')
    assert.equal(hexToString(gradient[2][1]), twoPartIpfsHash[1], 'ipfshash persisted')
    assert.equal(gradient[3], 0, 'error defaults to 0')
    assert.equal(gradient[4][0], 0, 'weights are initially 0')
    assert.equal(gradient[4][1], 0, 'weights are initially 0')
  })

  it('will not add gradients to models which do not exist', async () => {
    const twoPartIpfsHash = splitIpfsHashInMiddle('QmWmraMoctfbAaiEs2G46gpeUmhqFRDW6KWo64y5r581Vz')
    const modelRepositoryContract = await ModelRepository.deployed()
    const modelWhichDoesntExist = 1

    try {
      await modelRepositoryContract.addGradient(modelWhichDoesntExist, twoPartIpfsHash, {
        from: ulyssesTheUser
      })
    } catch (error) {
      assert.ok(error)
      return
    }
    assert.fail()
  })

  it('allows to evaluate gradients by the model owner', async () => {
    const irrelevantWeights = splitIpfsHashInMiddle('QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG')
    const modelRepositoryContract = await ModelRepository.deployed()
    await modelRepositoryContract.evalGradient(0, 0, irrelevantWeights)
  })
})

contract('ModelRepository - Evaluating Gradients', accounts => {
  const oscarTheModelOwner = accounts[0]
  const patTheGradientProvider = accounts[1]

  it('will not evaluate the same gradient twice', async () => {
    const bountyInWei = 10000
    const initialError = 42
    const targetError = 1337
    const modelRepositoryContract = await ModelRepository.deployed();
    await modelRepositoryContract.addModel(twoPartIpfsHash, initialError, targetError, {
      from: oscarTheModelOwner,
      value: bountyInWei
    })
    const modelId = 0
    await modelRepositoryContract.addGradient(modelId, twoPartIpfsHash, {
      from: patTheGradientProvider
    })
    const updatedWeights = splitIpfsHashInMiddle('QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG')

    const newError = 1;
    await modelRepositoryContract.evalGradient(0, newError, updatedWeights, {
      from: oscarTheModelOwner
    })
    const newErrorAttempt = 2;
    const evaluatedGradient = await modelRepositoryContract.getGradient.call(modelId, 0)
    await modelRepositoryContract.evalGradient(0, newErrorAttempt, updatedWeights, {
      from: oscarTheModelOwner
    })
    const unevaluatedGradient = await modelRepositoryContract.getGradient.call(modelId, 0)

    assert.equal(evaluatedGradient[3], newError, 'new error set')
    assert.notEqual(unevaluatedGradient[3], newErrorAttempt, 'error not updated')
  })
})
