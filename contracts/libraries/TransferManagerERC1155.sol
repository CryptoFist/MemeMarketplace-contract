// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../interfaces/ITransferManagerNFT.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

contract TransferManagerERC1155 is ITransferManagerNFT {
    address public immutable MemeMarketplace;

    constructor(address marketplaceAddress_) {
        MemeMarketplace = marketplaceAddress_;
    }

    function balanceOf(
        address collection,
        address owner,
        uint256 tokenID
    ) external view override returns(uint256) {
        IERC1155 token = IERC1155(collection);
        return token.balanceOf(owner, tokenID);
    }

    function transferNonFungibleToken(
        address collection,
        address from,
        address to,
        uint256 tokenId,
        uint256 amount
    ) external override {
        require(msg.sender == MemeMarketplace, "Transfer: Only Meme Marketplace");
        IERC1155 token = IERC1155(collection);
        token.safeTransferFrom(from, MemeMarketplace, tokenId, amount, "");
        token.safeTransferFrom(from, to, tokenId, amount, "");
    }
}
