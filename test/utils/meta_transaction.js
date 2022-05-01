const { ethers, upgrades, network } = require("hardhat")


const signMakeOrder = async (
  signer,
  verifier,
  order
) => {
  const chainId = await signer.getChainId();
  const domain = {
    name: "MemeMarketplace",
    version: "1",
    chainId,
    verifyingContract: verifier,
  };
  const types = {
    MakerOrder: [
      {
         name: "maker",
         type: "address"
      },
      {
         name: "tokenAddress",
         type: "address"
      },
      {
         name: "tokenID",
         type: "uint256"
      },
      {
         name: "price",
         type: "uint256"
      },
      {
         name: "tokenAmount",
         type: "uint256"
      },
      {
         name: "isETH",
         type: "bool"
      },
    ],
  };
  const rawSignature = await signer._signTypedData(domain, types, order);
  const signature = ethers.utils.splitSignature(rawSignature);
  return {
    ...order,
    r: signature.r,
    s: signature.s,
    v: signature.v,
  };
}


module.exports = {
   signMakeOrder
}