// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

interface ITransferManagerNFT {
    function transferNonFungibleToken(
        address collection,
        address from,
        address to,
        uint256 tokenId,
        uint256 amount
    ) external;

     function balanceOf(
        address collection,
        address owner,
        uint256 tokenID
    ) external view returns(uint256);
}