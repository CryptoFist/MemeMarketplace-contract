// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../interfaces/ITransferManagerNFT.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TransferManagerERC1155 is Ownable, ITransferManagerNFT {
    address public MemeMarketplace;

    function setMarketPlace(address marketplaceAddress_) external onlyOwner {
        MemeMarketplace = marketplaceAddress_;
    }

    function balanceOf(
        address collection_,
        address owner_,
        uint256 tokenID_
    ) external view override returns(uint256) {
        IERC1155 token = IERC1155(collection_);
        return token.balanceOf(owner_, tokenID_);
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
