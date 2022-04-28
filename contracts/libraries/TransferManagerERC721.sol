// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../interfaces/ITransferManagerNFT.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract TransferManagerERC721 is ITransferManagerNFT {
    address public immutable MemeMarketplace;

    constructor(address marketplaceAddress_) {
        MemeMarketplace = marketplaceAddress_;
    }

    function balanceOf(
        address collection,
        address owner,
        uint256 tokenID
    ) external view override returns(uint256) {
        IERC721 token = IERC721(collection);
        return token.ownerOf(tokenID) == owner ? 1 : 0;
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
