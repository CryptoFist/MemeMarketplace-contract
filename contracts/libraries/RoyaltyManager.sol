// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

contract RoyaltyManager {
   address private marketplaceAddress;
   mapping(address => mapping(uint256 => address)) private royaltyReceiver;

   constructor(address marketplaceAddress_) {
      marketplaceAddress = marketplaceAddress_;
   }

   function setRoyaltyReceiver(
      address owner_,
      address tokenAddress_,
      uint256 tokenID_
   ) external {
      require(msg.sender == marketplaceAddress, 'no permission');
      royaltyReceiver[tokenAddress_][tokenID_] = owner_;
   }

   function getRoyaltyReceiver(
      address tokenAddress_,
      uint256 tokenID_
   ) external view returns(address) {
      return royaltyReceiver[tokenAddress_][tokenID_];
   }

}