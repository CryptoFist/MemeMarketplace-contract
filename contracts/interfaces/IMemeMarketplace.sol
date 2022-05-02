// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

interface IMemeMarketplace {
   function addCollection(
      address owner_,
      address tokenAddress_,
      uint256[] memory tokenIDs_
   ) external;
}