import { task } from 'hardhat/config'
import verify from '../scripts/verify'
import { ReturnObjectSemaphoreDeployTask } from '../types'
import fs from 'fs'

task('verify-contracts').setAction(async ({}, { ethers, network }) => {
  const content = JSON.parse(
    fs.readFileSync('./resources/contract-network-config.json', 'utf-8')
  )
  const networkDetails = content['networks'][network.name]

  await verify(networkDetails['IncrementalBinaryTree'].address, network.name)
  await verify(networkDetails['Pairing'].address, network.name)
  await verify(networkDetails['SemaphoreVerifier'].address, network.name)
  await verify(networkDetails['Semaphore'].address, network.name)
  await verify(networkDetails['Reclaim'].address, network.name)
})
