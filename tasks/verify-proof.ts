import { task } from 'hardhat/config'
import { getContractAddress } from './utils'
import { Reclaim } from "../src/types";
import { Claims } from "../src/types";

task('verify-proof')
  .setDescription('Verify proof into reclaim')
//   .addParam('', 'name of the dapp you want to register')
  .setAction(async ({ }, { ethers, upgrades, network }) => {
        const signerAddress = await ethers.provider.getSigner().getAddress();
        console.log(
            `verifying proof on "${network.name}" from address "${signerAddress}"`
        );

        const reclaimFactory = await ethers.getContractFactory('Reclaim')
        const contractAddress = getContractAddress(network.name, 'Reclaim')
        const reclaim = await reclaimFactory.attach(contractAddress)

        // Verify Proof

        const owner = "0xe4c20c9f558160ec08106de300326f7e9c73fb7f"

        const claimInfo = {
            "provider": "http",
            "parameters": "{\"body\":\"\",\"geoLocation\":\"in\",\"method\":\"GET\",\"responseMatches\":[{\"type\":\"contains\",\"value\":\"_steamid\\\">Steam ID: 76561199632643233</div>\"}],\"responseRedactions\":[{\"jsonPath\":\"\",\"regex\":\"_steamid\\\">Steam ID: (.*)</div>\",\"xPath\":\"id(\\\"responsive_page_template_content\\\")/div[@class=\\\"page_header_ctn\\\"]/div[@class=\\\"page_content\\\"]/div[@class=\\\"youraccount_steamid\\\"]\"}],\"url\":\"https://store.steampowered.com/account/\"}",
            "context": "{\"contextAddress\":\"user's address\",\"contextMessage\":\"for acmecorp.com on 1st january\"}",
        }

        const identifier = "0x531322a6c34e5a71296a5ee07af13f0c27b5b1e50616f816374aff6064daaf55"

        const signedClaim = {
            "claim": {
                "identifier": identifier,
                "owner": owner,
                "epoch": 1,
                "timestampS": 1710157447
            },
            "signatures": ["0x52e2a591f51351c1883559f8b6c6264b9cb5984d0b7ccc805078571242166b357994460a1bf8f9903c4130f67d358d7d6e9a52df9a38c51db6a10574b946884c1cb"],
        }


        const proof: Reclaim.ProofStruct = {
            claimInfo: claimInfo,
            signedClaim: signedClaim
        }
        
        const verifyResponse = await reclaim.verifyProof(proof);

        await verifyResponse.wait()
        console.log(verifyResponse);
    }
)

