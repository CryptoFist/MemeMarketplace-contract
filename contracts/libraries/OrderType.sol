// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

library OrderType {
   bytes32 internal constant MAKER_ORDER_HASH = 0x40261ade532fa1d2c7293df30aaadb9b3c616fae525a0b56d3d411c841a85028;
   
   struct MakerOrder {
      address maker;
      address tokenAddress;
      uint256 tokenID;
      uint256 price;
      uint256 tokenAmount;   // 1: ERC721, >1: ERC1155
      bytes32 r;
      bytes32 s;
      uint8 v;
      bool isETH;
   }

   function hash(MakerOrder memory makerOrder_) internal pure returns (bytes32) {
      return keccak256(
         abi.encode(
            MAKER_ORDER_HASH,
            makerOrder_.maker,
            makerOrder_.tokenAddress,
            makerOrder_.tokenID,
            makerOrder_.price,
            makerOrder_.tokenAmount,
            makerOrder_.isETH
         )
      );
   }
}