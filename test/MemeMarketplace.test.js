const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deploy, deployProxy, getAt } = require('../scripts/utils');
const { signMakeOrder } = require("./utils/meta_transaction");

const bigNum = num=>(num + '0'.repeat(18))
const smallNum = num=>(parseInt(num)/bigNum(1))
const zeroAddress = '0x0000000000000000000000000000000000000000';

const tokenURI = 'https://gateway.pinata.cloud/ipfs/QmfUk1XLTrgQmbjwGw7sKa1DggNeZoYtk5JD4n4bq1eRHk';

describe('MemeMarketplace', function () {
   before (async function () {
      [
         this.deployer,
         this.minter1,
         this.minter2,
         this.bider1,
         this.bider2,
         this.multisig,
         this.scammer1,
         this.scammer2,
         this.fundAddress
      ] = await ethers.getSigners();

      this.strategyManager = await deployProxy('MemeStrategyManager');
      this.ERC721Manager = await deploy('TransferManagerERC721');
      this.ERC1155Manager = await deploy('TransferManagerERC1155');
      this.WETH = await deploy('WETH');
      this.Meme721 = await deploy('Meme721', 'Meme 721', 'MEME721');
      this.Meme1155 = await deploy('Meme1155');

      this.marketplace = await deploy(
         'MemeMarketplace',
         this.strategyManager.address,
         this.ERC721Manager.address,
         this.ERC1155Manager.address,
         this.Meme721.address,
         this.Meme1155.address,
         this.WETH.address,
         this.multisig.address
      );

      await this.Meme721.setMarketplaceAddress(this.marketplace.address);
      await this.Meme1155.setMarketplaceAddress(this.marketplace.address);
      await this.ERC721Manager.setMarketPlace(this.marketplace.address);
      await this.ERC1155Manager.setMarketPlace(this.marketplace.address);
      await this.strategyManager.addOwner(this.marketplace.address);
   })

   it ('check initial state', async function () {
      expect(smallNum(await this.WETH.balanceOf(this.deployer.address))).to.equal(10**6);
   })

   it ('mint Meme721 and add collection to marketplace', async function () {
      await this.marketplace.connect(this.minter1).mintMeme721(
         [tokenURI],
         {value: BigInt(10 ** 15)}
      );
   })

   it ('buy Meme721', async function () {

      const makeOrder = {
         maker: this.minter1.address,
         tokenAddress: this.Meme721.address,
         tokenID: 0,
         price: bigNum(1),
         tokenAmount: 1,
         isETH: true
      };

      const signedMakeOrder = await signMakeOrder(
         this.minter1,
         this.marketplace.address,
         makeOrder
      );

      let oldETHValue = smallNum(await ethers.provider.getBalance(this.minter1.address));
      let oldNFTValue = await this.Meme721.balanceOf(this.bider1.address);

      await this.Meme721.connect(this.minter1).setApprovalForAll(this.ERC721Manager.address, true);
      await this.marketplace.connect(this.bider1).buyNonFindgibleToken(
         signedMakeOrder,
         {value: bigNum(1)}
      );

      let newETHValue = smallNum(await ethers.provider.getBalance(this.minter1.address));
      let newNFTValue = await this.Meme721.balanceOf(this.bider1.address);

      expect(newNFTValue - oldNFTValue).to.equal(1);
      expect(newETHValue - oldETHValue).to.greaterThan(0.97);
   })

   it ('mint Meme1155 and add collection to marketplace', async function () {
      await this.marketplace.connect(this.minter1).mintMeme1155(tokenURI, 20, {value: BigInt(10 ** 15 * 20)});
      expect(
         await this.Meme1155.balanceOf(this.minter1.address, 0)
      ).to.equal(20);

      expect(
         await this.Meme1155.totalSupply(0)
      ).to.equal(20);

      expect(
         await this.Meme1155.exists(0)
      ).to.equal(true);

      expect(
         await this.Meme1155.exists(1)
      ).equal(false);
   })

   it ('buy Meme1155', async function () {
      const makeOrder = {
         maker: this.minter1.address,
         tokenAddress: this.Meme1155.address,
         tokenID: 0,
         price: bigNum(5),
         tokenAmount: 5,
         isETH: true
      };

      const signedMakeOrder = await signMakeOrder(
         this.minter1,
         this.marketplace.address,
         makeOrder
      );

      let oldETHValue = smallNum(await ethers.provider.getBalance(this.minter1.address));
      let oldNFTValue = await this.Meme1155.balanceOf(this.bider1.address, 0);

      await this.Meme1155.connect(this.minter1).setApprovalForAll(this.ERC1155Manager.address, true);
      await this.marketplace.connect(this.bider1).buyNonFindgibleToken(
         signedMakeOrder,
         {value: bigNum(5)}
      );

      let newETHValue = smallNum(await ethers.provider.getBalance(this.minter1.address));
      let newNFTValue = await this.Meme1155.balanceOf(this.bider1.address, 0);

      expect(newNFTValue - oldNFTValue).to.equal(5);
      expect(newETHValue - oldETHValue).to.greaterThan(4.8);
   })

   it ('set different mint price and accept offer', async function () {
      await this.marketplace.setMeme721Price(BigInt(2 * 10 ** 15));
      await this.marketplace.setMeme1155Price(BigInt(2 * 10 ** 15));

      await expect(
         this.marketplace.connect(this.minter2).mintMeme721([tokenURI], {value: BigInt(10**15)})
      ).to.be.revertedWith('not enough money');

      await this.marketplace.connect(this.minter2).mintMeme721([tokenURI], {value: BigInt(2 * 10**15)});

      await expect(
         this.marketplace.connect(this.bider2).mintMeme1155(tokenURI, 20, {value: BigInt(20 * 10**15)})
      ).to.be.revertedWith('not enough money');

      await this.marketplace.connect(this.bider2).mintMeme1155(tokenURI, 20, {value: BigInt(20 * 2 * 10**15)});

      // send WETH to minter2
      await this.WETH.transfer(this.bider2.address, bigNum(10));

      await this.Meme721.connect(this.minter2).setApprovalForAll(this.ERC721Manager.address, true);
      await this.Meme1155.connect(this.bider2).setApprovalForAll(this.ERC1155Manager.address, true);

      const makeOrder = {
         maker: this.minter2.address,
         tokenAddress: this.Meme721.address,
         tokenID: 1,
         price: bigNum(4),
         tokenAmount: 1,
         isETH: false
      };

      const takerOrder = {
         maker: this.bider2.address,
         tokenAddress: this.Meme1155.address,
         tokenID: 1,
         price: 0,
         tokenAmount: 10,
         isETH: false
      };

      const signedMakeOrder = await signMakeOrder(
         this.minter2,
         this.marketplace.address,
         makeOrder
      );

      const signedTakerOrder = await signMakeOrder(
         this.bider2,
         this.marketplace.address,
         takerOrder
      );

      const oldWETHBal = smallNum(await this.WETH.balanceOf(this.minter2.address));
      const oldMeme1155Bal = await this.Meme1155.balanceOf(this.minter2.address, 1);
      const oldMeme721Bal = await this.Meme721.balanceOf(this.bider2.address);

      await this.WETH.connect(this.bider2).approve(this.marketplace.address, bigNum(10));
      await this.marketplace.connect(this.bider2).acceptOffer(signedMakeOrder, signedTakerOrder);

      const newWETHBal = smallNum(await this.WETH.balanceOf(this.minter2.address));
      const newMeme1155Bal = await this.Meme1155.balanceOf(this.minter2.address, 1);
      const newMeme721Bal = await this.Meme721.balanceOf(this.bider2.address);

      expect(newWETHBal - oldWETHBal).to.greaterThan(3.9);
      expect(newMeme1155Bal - oldMeme1155Bal).to.equal(10);
      expect(newMeme721Bal - oldMeme721Bal).to.equal(1);
   })

   it ('match auction', async function () {
      const makeOrder = {
         maker: this.bider1.address,
         tokenAddress: this.Meme721.address,
         tokenID: 0,
         price: bigNum(1),
         tokenAmount: 1,
         isETH: false
      };

      const signedMakeOrder = await signMakeOrder(
         this.bider1,
         this.marketplace.address,
         makeOrder
      );

      // send WETH to minter2
      await this.WETH.transfer(this.minter1.address, bigNum(10));

      let oldETHValue = smallNum(await this.WETH.balanceOf(this.bider1.address));
      let oldNFTValue = await this.Meme721.balanceOf(this.minter1.address);

      await this.marketplace.removeCollection(
         this.Meme721.address,
         [0]
      );

      await this.WETH.connect(this.minter1).approve(this.marketplace.address, bigNum(10));
      await this.Meme721.connect(this.bider1).setApprovalForAll(this.ERC721Manager.address, true);

      await expect(
         this.marketplace.connect(this.minter1).matchAuction(
            signedMakeOrder
         )
      ).to.be.revertedWith('not added token');

      await expect(
         this.marketplace.addCollection(
            this.minter1.address,
            this.Meme721.address,
            [0]
         )
      ).to.be.revertedWith('wrong user');

      await this.marketplace.connect(this.bider1).addCollection(
         this.bider1.address,
         this.Meme721.address,
         [0]
      );

      await this.marketplace.setRoyalty(10 ** 3);

      await this.marketplace.connect(this.minter1).matchAuction(
         signedMakeOrder
      );

      let newETHValue = smallNum(await this.WETH.balanceOf(this.bider1.address));
      let newNFTValue = await this.Meme721.balanceOf(this.minter1.address);

      expect(newNFTValue - oldNFTValue).to.equal(1);
      expect(newETHValue - oldETHValue).to.greaterThan(0.97);
   })

   it ('set fund address and withdraw', async function () {
      await this.marketplace.connect(this.multisig).setFundAddress(this.fundAddress.address);
      const oldETHBal = smallNum(await ethers.provider.getBalance(this.fundAddress.address));
      const oldWETHBal = smallNum(await this.WETH.balanceOf(this.fundAddress.address));

      await this.marketplace.withDraw();

      const newETHBal = smallNum(await ethers.provider.getBalance(this.fundAddress.address));
      const newWETHBal = smallNum(await this.WETH.balanceOf(this.fundAddress.address));

      expect(newETHBal - oldETHBal).to.greaterThanOrEqual(0.18);
      expect(newWETHBal - oldWETHBal).to.greaterThanOrEqual(0.1);
   })

})