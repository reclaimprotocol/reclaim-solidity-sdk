import dotenv from "dotenv";
dotenv.config();

import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "@semaphore-protocol/hardhat";
import "solidity-coverage";
import "./tasks";

const { PRIVATE_KEY, ALCHEMY_API_KEY, NETWORK } = process.env;
const hasCustomNetwork = NETWORK && NETWORK !== "hardhat";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";
if (hasCustomNetwork) {
  if (!PRIVATE_KEY) {
    throw new Error("PRIVATE_KEY not set");
  }

  if (!ALCHEMY_API_KEY) {
    throw new Error("ALCHEMY_API_KEY not set");
  }
}

const API_TEMPLATE = "https://{{network}}.g.alchemy.com/v2/{{key}}";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.4",
    settings: {
      viaIR: false,
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  defaultNetwork: NETWORK,
  networks: {
    hardhat: {},
    linea_testnet: {
      url: `https://linea-goerli.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: [process.env.PRIVATE_KEY!],
      gas: 7100000,
      gasPrice: 80100010000,
    },
    opt_goerli: {
      url: `https://opt-goerli.g.alchemy.com/v2/GZ-aIq52UCdrNOdonkLAX7jS2qfpRx9X`,
      accounts: [process.env.PRIVATE_KEY!],
      gasPrice: 80100010,
    },

    // ...(hasCustomNetwork
    //   ? {
    //       [NETWORK]: {
    //         url: API_TEMPLATE.replace("{{network}}", NETWORK).replace(
    //           "{{key}}",
    //           ALCHEMY_API_KEY!
    //         ),
    //         // uncomment to make tx go faster
    //         // gasPrice: 450000000000,
    //         accounts: [PRIVATE_KEY],
    //       },
    //     }
    //   : {}),
  },
  typechain: {
    outDir: "src/types",
    target: "ethers-v5",
  },
  etherscan: {
    apiKey: {
      linea_testnet: process.env.LINEASCAN_API_KEY || "",
      optimisticGoerli: process.env.ETHERSCAN_API_KEY!,
    },
    customChains: [
      {
        network: "linea_testnet",
        chainId: 59140,
        urls: {
          apiURL: "https://explorer.goerli.linea.build/api",
          browserURL: "https://explorer.goerli.linea.build",
        },
      },
      {
        network: "opt_goerli",
        chainId: 59140,
        urls: {
          apiURL: "https://api-goerli-optimistic.etherscan.io/",
          browserURL: "https://goerli-optimism.etherscan.io/",
        },
      },
    ],
  },
};

export default config;
