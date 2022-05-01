// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../interfaces/ITransferManagerNFT.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TransferManagerERC721 is Ownable, ITransferManagerNFT {
    address private MemeMarketplace;

    function setMarketPlace(address marketplaceAddress_) external onlyOwner {
        MemeMarketplace = marketplaceAddress_;
    }

    function balanceOf(
        address collection_,
        address owner_,
        uint256 tokenID_
    ) external view override returns(uint256) {
        IERC721 token = IERC721(collection_);
        return token.ownerOf(tokenID_) == owner_ ? 1 : 0;
    }

    function transferNonFungibleToken(
        address collection,
        address from,
        address to,
        uint256 tokenId,
        uint256
    ) external override {
        require(msg.sender == MemeMarketplace, "Transfer: Only Meme Marketplace");
        IERC721 token = IERC721(collection);
        token.safeTransferFrom(from, MemeMarketplace, tokenId);
        token.safeTransferFrom(MemeMarketplace, to, tokenId);
    }
}
