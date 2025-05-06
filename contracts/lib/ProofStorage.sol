// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import {ERC725Y} from "@erc725/smart-contracts/contracts/ERC725Y.sol";


/**
 * @title ProofStorage
 * @dev A contract that stores proofs, which are key-value pairs of claim identifiers and proof data.
 *      This contract inherits from ERC725Y to leverage its key-value store functionalities.
 */
contract ProofStorage is ERC725Y {

    // Address of the Reclaim contract that is authorized to store proofs.
    address public Reclaim;

    /**
     * @dev Initializes the contract setting the owner of the ERC725Y key-value store.
     * @param newOwner The address of the new owner of the contract.
     */
    constructor(address newOwner) ERC725Y(newOwner) {}


    /**
     * @dev Structure to store proof details.
     * @param claimIdentifier A unique identifier for the claim.
     * @param data The proof data associated with the claim.
     */
    struct Proof {
        bytes32 claimIdentifier;
        bytes data;
    }

    // Mapping from claim identifiers to their corresponding proofs.
    mapping(bytes32 => Proof) private proofs;

    // Event emitted when a proof is stored.
    event ProofStored(bytes32 indexed claimIdentifier, bytes data);

    /**
     * @dev Stores a proof in the contract.
     *      This function can be called by external contracts or addresses.
     * @param claimIdentifier The unique identifier for the claim.
     * @param data The proof data to be stored.
     */
    function storeProof(bytes32 claimIdentifier, bytes memory data) external {
        // Store the proof in the mapping
        proofs[claimIdentifier] = Proof(claimIdentifier, data);

        // Emit the ProofStored event to log the storage operation
        emit ProofStored(claimIdentifier, data);
    }


    /**
     * @dev Retrieves a stored proof by its claim identifier.
     * @param claimIdentifier The unique identifier for the claim.
     * @return The proof associated with the given claim identifier.
     */
    function getProof(bytes32 claimIdentifier) external view returns (Proof memory) {
        // Return the proof corresponding to the claim identifier
        return proofs[claimIdentifier];
    }
}