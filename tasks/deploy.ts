import { task } from 'hardhat/config'
import verify from '../scripts/verify'
import { ReturnObjectSemaphoreDeployTask } from '../types'
import fs from 'fs'

task('deploy').setAction(async ({}, { ethers, network, upgrades }) => {
  const content = JSON.parse(
    fs.readFileSync('./resources/contract-network-config.json', 'utf-8')
  )
  const networkDetails = content['networks'][network.name]

  const {
    semaphore,
    pairingAddress,
    semaphoreVerifierAddress,
    poseidonAddress,
    incrementalBinaryTreeAddress
  } = // @ts-expect-error events
    (await run('deploy:semaphore')) as ReturnObjectSemaphoreDeployTask

  const [deployer] = await ethers.getSigners();

  // Deploy ProofStorage contract
  const ProofStorage = await ethers.getContractFactory("ProofStorage");
  const proofStorage = await ProofStorage.deploy(deployer.address);
  await proofStorage.deployed();

  console.log('ProofStorage deployed to:', proofStorage.address)

  const Reclaim = await ethers.getContractFactory('Reclaim')
  const reclaim = await Reclaim.deploy(semaphore.address, proofStorage.address);
  await reclaim.deployed();

  console.log('Reclaim Proxy deployed to: ', reclaim.address)

  await verify(incrementalBinaryTreeAddress, network.name)
  await verify(pairingAddress, network.name)
  await verify(semaphoreVerifierAddress, network.name)
  await verify(semaphore.address, network.name, [semaphoreVerifierAddress])
  await verify(reclaim.address, network.name, [semaphore.address, proofStorage.address])
  await verify(proofStorage.address, network.name,[deployer.address])
})
