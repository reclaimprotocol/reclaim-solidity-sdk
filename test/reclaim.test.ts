import {
  CompleteClaimData,
  createSignDataForClaim,
  fetchWitnessListForClaim,
  hashClaimInfo
} from '@reclaimprotocol/crypto-sdk'

import { Identity } from '@semaphore-protocol/identity'
import { Group } from '@semaphore-protocol/group'
import { generateProof } from '@semaphore-protocol/proof'
import { expect } from 'chai'
import { BigNumber, utils } from 'ethers'
import { Reclaim } from '../src/types'
import {
  deployReclaimContract,
  generateMockWitnessesList,
  randomEthAddress,
  randomWallet,
  randomiseWitnessList
} from './utils'
import { ethers, run, upgrades } from 'hardhat'

import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { randomBytes } from 'crypto'

import { deployFixture, proofsFixture } from './fixtures'

describe('Reclaim Tests', () => {
  const NUM_WITNESSES = 5
  const MOCK_HOST_PREFIX = 'localhost:555'

  it('should fail to execute admin functions if not owner', async () => {
    let { contract, witnesses } = await loadFixture(deployFixture)
    const NOT_OWNER_MSG = 'Ownable: caller is not the owner'
    const user = await randomWallet(1, ethers.provider)
    contract = await contract.connect(user)

    const expectedRejections = [() => contract.addNewEpoch(witnesses, 5)]
    for (const reject of expectedRejections) {
      expect(reject()).to.be.revertedWith(NOT_OWNER_MSG)
    }
  })

  it('should insert some epochs', async () => {
    let { contract, witnesses } = await loadFixture(deployFixture)
    const currentEpoch = await contract.currentEpoch()
    for (let i = 1; i < 5; i++) {
      const tx = await contract.addNewEpoch(witnesses, 5)
      await tx.wait()
      // current epoch
      const epoch = await contract.fetchEpoch(0)
      expect(epoch.id).to.be.eq(currentEpoch + i)
      expect(epoch.witnesses).to.have.length(NUM_WITNESSES)
      expect(epoch.timestampStart).to.be.gt(0)

      const epochById = await contract.fetchEpoch(epoch.id)
      expect(epochById.id).to.be.eq(epoch.id)
    }
  })

  it('emit an event after creating a group', async () => {
    let { contract } = await loadFixture(deployFixture)
    expect(await contract.createGroup('test', 18)).to.emit(
      contract,
      'GroupCreated'
    )
  })

  it('should fail to create group with Reclaim__GroupAlreadyExists error', async () => {
    let { contract } = await loadFixture(deployFixture)
    expect(await contract.createGroup('test', 18)).to.emit(
      contract,
      'GroupCreated'
    )

    expect(contract.createGroup('test', 18)).to.be.revertedWith(
      'Reclaim__GroupAlreadyExists'
    )
  })
  describe('Proofs tests', async () => {
    it('should verify a claim', async () => {
      let { contract, user, superProofs } = await loadFixture(proofsFixture)
      await contract.connect(user).verifyProof(superProofs[1])
    })

    it('should return the provider name from the proof', async () => {
      let { contract, superProofs } = await loadFixture(proofsFixture)
      const result = await contract.getProviderFromProof(superProofs[0])
      expect(result).to.equal(superProofs[0].claimInfo.provider)
    })

    it('should return the context message from the proof', async () => {
      let { contract, superProofs } = await loadFixture(proofsFixture)
      const result = await contract.getContextMessageFromProof(superProofs[0])
      let context = superProofs[0].claimInfo.context as string
      expect(result).to.equal(context.substring(42, context.length))
    })

    it('should return the context address from the proof', async () => {
      let { contract, superProofs } = await loadFixture(proofsFixture)
      const result = await contract.getContextAddressFromProof(superProofs[0])
      let context = superProofs[0].claimInfo.context as string
      expect(result).to.equal(context.substring(0, 42))
    })

    it('should return the context address from the proof', async () => {
      let { contract, superProofs } = await loadFixture(proofsFixture)
      const result = await contract.getContextAddressFromProof(superProofs[0])
      let context = superProofs[0].claimInfo.context as string
      expect(result).to.equal(context.substring(0, 42))
    })

    it('should create unique groupId for each provider', async () => {
      let { contract } = await loadFixture(proofsFixture)
      const providersMock = ['google-account', 'github-cred', 'account-google']
      const groupIds: Set<Number> = new Set()
      for (let provider of providersMock) {
        const txReceipt = await (
          await contract.createGroup(provider, 18)
        ).wait()
        if (
          txReceipt.events !== undefined &&
          txReceipt.events[2].args !== undefined
        ) {
          groupIds.add(txReceipt.events[2].args[0].toNumber())
        }
      }
      expect(providersMock.length).to.equal(groupIds.size)
    })

    it('should contract be admin, merkelize the user, create dapp and verify merkle identity', async () => {
      let { contract, superProofs, semaphore, witnesses } = await loadFixture(
        proofsFixture
      )

      // Creating group and add member through recalim
      const tx = await contract.createGroup(
        superProofs[1].claimInfo.provider,
        20
      )
      const txReceipt = await tx.wait(1)
      let groupId
      if (
        txReceipt.events !== undefined &&
        txReceipt.events[2].args !== undefined
      ) {
        groupId = txReceipt.events[2].args[0].toString()
      }

      const identity = new Identity()
      const member = identity.getCommitment().toString()
      const txMerkelizeFirstUser = await contract.merkelizeUser(
        superProofs[1],
        member
      )
      await txMerkelizeFirstUser.wait()
      await expect(txMerkelizeFirstUser).to.emit(semaphore, 'MemberAdded')

      const admin = (await semaphore.groups(groupId)).admin
      expect(contract.address).to.equal(admin)

      let group = new Group(groupId)
      group.addMember(member)

      const signal = utils.formatBytes32String('Hellox')
      const id = group.root
      const createDappTranactionResponse = await contract.createDapp(id)
      expect(createDappTranactionResponse).to.emit(contract, 'DappCreated')

      const createDappTransactionReceipt =
        await createDappTranactionResponse.wait()

      const dappId = createDappTransactionReceipt.events![0]!.args![0]!

      const fullProof = await generateProof(identity, group, id, signal, {
        zkeyFilePath: './resources/semaphore.zkey',
        wasmFilePath: './resources/semaphore.wasm'
      })

      const semaphoreTransaction = await contract.verifyMerkelIdentity(
        superProofs[1].claimInfo.provider,
        fullProof.merkleTreeRoot,
        fullProof.signal,
        fullProof.nullifierHash,
        fullProof.externalNullifier,
        dappId,
        fullProof.proof
      )
      await expect(semaphoreTransaction)
        .to.emit(semaphore, 'ProofVerified')
        .withArgs(
          groupId,
          fullProof.merkleTreeRoot,
          fullProof.nullifierHash,
          fullProof.externalNullifier,
          fullProof.signal
        )
    })

    it('should merkelize user and create group in one call', async () => {
      let { contract, superProofs, semaphore } = await loadFixture(
        proofsFixture
      )
      const identity = new Identity()
      const member = identity.getCommitment().toString()
      const tx = await contract.merkelizeUser(superProofs[1], member)
      expect(tx).to.emit(contract, 'GroupCreated')
    })

    it('should fail to merkelize the user twice with UserAlreadyMerkelized error', async () => {
      let { contract, superProofs, semaphore } = await loadFixture(
        proofsFixture
      )
      const identity = new Identity()
      const member = identity.getCommitment().toString()
      const tx = await contract.merkelizeUser(superProofs[1], member)

      await expect(
        contract.merkelizeUser(superProofs[1], member)
      ).to.be.revertedWithCustomError(
        contract,
        'Reclaim__UserAlreadyMerkelized'
      )
    })
    it('should fail to verifyMerkleIdentity with Dapp Not Created error', async () => {
      let { contract, superProofs, semaphore } = await loadFixture(
        proofsFixture
      )

      const identity = new Identity()
      const member = identity.getCommitment().toString()

      // Creating group and add member through recalim
      const tx = await contract.createGroup(
        superProofs[1].claimInfo.provider,
        20
      )
      const txReceipt = await tx.wait(1)
      const txMerkelize = await contract.merkelizeUser(superProofs[1], member)
      await txMerkelize.wait()

      // get groupId from events
      let groupId = txReceipt.events![2]!.args![0]!.toString()

      let group = new Group(groupId)
      group.addMember(member)

      const signal = utils.formatBytes32String('Hellox')

      const fullProof = await generateProof(
        identity,
        group,
        group.root,
        signal,
        {
          zkeyFilePath: './resources/semaphore.zkey',
          wasmFilePath: './resources/semaphore.wasm'
        }
      )

      const verifyMerkelIdentityTransactionPromise =
        contract.verifyMerkelIdentity(
          groupId,
          fullProof.merkleTreeRoot,
          fullProof.signal,
          fullProof.nullifierHash,
          fullProof.externalNullifier,
          groupId,
          fullProof.proof
        )

      expect(verifyMerkelIdentityTransactionPromise).to.be.revertedWith(
        'Dapp Not Created'
      )
    })

    it('should fail to merkelize user with no signatures error', async () => {
      let { contract, superProofs, semaphore } = await loadFixture(
        proofsFixture
      )
      const identity = new Identity()

      const member = identity.getCommitment().toString()

      await contract.createGroup(superProofs[1].claimInfo.provider, 20)

      superProofs[1].signedClaim.signatures = []

      expect(contract.merkelizeUser(superProofs[1], member)).to.be.revertedWith(
        'No signatures'
      )
    })

    it('should fail to merkelize user with number of signatures not equal to number of witnesses error', async () => {
      let { contract, superProofs, semaphore } = await loadFixture(
        proofsFixture
      )
      const identity = new Identity()

      const member = identity.getCommitment().toString()

      await contract.createGroup(superProofs[1].claimInfo.provider, 20)

      superProofs[1].signedClaim.signatures.pop()

      expect(contract.merkelizeUser(superProofs[1], member)).to.be.revertedWith(
        'Number of signatures not equal to number of witnesses'
      )
    })

    it('should fail to merkelize user with signatures not appropriate error', async () => {
      let { contract, superProofs, semaphore } = await loadFixture(
        proofsFixture
      )
      const identity = new Identity()

      const member = identity.getCommitment().toString()

      await contract.createGroup(superProofs[1].claimInfo.provider, 20)

      superProofs[1].signedClaim.signatures.pop()
      superProofs[1].signedClaim.signatures = [
        randomBytes(12),
        ...superProofs[1].signedClaim.signatures
      ]

      expect(contract.merkelizeUser(superProofs[1], member)).to.be.revertedWith(
        'Signature not appropriate'
      )
    })

    it('should fail to create dapp with Dapp Already Exists error', async () => {
      let { contract, superProofs, semaphore } = await loadFixture(
        proofsFixture
      )
      const proposedDappId = Math.floor(Math.random() * 6) + 1
      const createDappTranactionResponse = await contract.createDapp(
        proposedDappId
      )

      expect(contract.createDapp(proposedDappId)).to.be.revertedWith(
        'Dapp Already Exists'
      )
    })
  })
})

describe('Reclaim Witness Fetch Tests', () => {
  const NUM_WITNESSES = 15
  const MOCK_HOST_PREFIX = 'localhost:555'
  let contract: Reclaim
  let witnesses: Reclaim.WitnessStruct[] = []

  beforeEach(async () => {
    const { semaphore } = await run('deploy:semaphore', {
      logs: false
    })

    contract = await deployReclaimContract(semaphore, ethers, upgrades)
    let { mockWitnesses } = await generateMockWitnessesList(
      NUM_WITNESSES,
      MOCK_HOST_PREFIX,
      ethers
    )
    witnesses = await randomiseWitnessList(mockWitnesses)
  })

  // check TS & solidity implementations match
  it('match fetchWitnessList implementation for claim', async () => {
    await contract.addNewEpoch(witnesses, 5)
    const currentEpoch = await contract.fetchEpoch(0)

    const identifier = hashClaimInfo({
      parameters: '1234',
      provider: 'test',
      context: 'test'
    })

    const timestampS = Math.floor(Date.now() / 1000)

    const witnessesTs = await fetchWitnessListForClaim(
      {
        epoch: currentEpoch.id,
        witnesses: currentEpoch.witnesses.map(w => ({
          id: w.addr,
          url: w.host
        })),
        witnessesRequiredForClaim:
          currentEpoch.minimumWitnessesForClaimCreation,
        nextEpochTimestampS: 0
      },
      identifier,
      timestampS
    )

    const witnessesContract = await contract.fetchWitnessesForClaim(
      currentEpoch.id,
      identifier,
      timestampS
    )

    const witnessesContractHosts = witnessesContract.length
    for (let i = 0; i < witnessesContractHosts; i++) {
      expect(witnessesContract[i].host.toLowerCase()).to.equal(
        witnessesTs[i].url.toLowerCase()
      )
    }
  })
})
