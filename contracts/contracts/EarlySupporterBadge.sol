// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface ITreasuryVault {
    function userShares(address user) external view returns (uint256);
    function userInfo(address user) external view returns (
        uint256 totalDeposited,
        uint256 totalWithdrawn,
        uint256 depositTimestamp,
        uint256 totalPoints,
        uint256 lockedPositionsCount
    );
}

/**
 * @title EarlySupporterBadge
 * @notice NFT badge for early Arc Treasury supporters
 * @dev Mintable by users who deposited in vault OR are whitelisted
 *      Limited time availability - early supporter recognition
 */
contract EarlySupporterBadge is ERC721, Ownable, ReentrancyGuard {

    /// @notice Maximum supply of badges
    uint256 public constant MAX_SUPPLY = 5000;

    /// @notice Current token ID counter
    uint256 private _tokenIdCounter;

    /// @notice Base URI for token metadata
    string private _baseTokenURI;

    /// @notice Treasury Vault contract for deposit verification
    ITreasuryVault public vault;

    /// @notice Whether minting is enabled
    bool public mintingEnabled = true;

    /// @notice Deadline for minting (0 = no deadline)
    uint256 public mintDeadline;

    /// @notice Minimum deposit required to mint (in shares, 18 decimals)
    uint256 public minDepositRequired = 0;

    /// @notice Mapping to track if address has already minted
    mapping(address => bool) public hasMinted;

    /// @notice Whitelist for addresses that can mint without deposit
    mapping(address => bool) public whitelist;

    /// @notice Events
    event Mint(address indexed to, uint256 indexed tokenId, bool wasWhitelisted);
    event MintingEnabled(bool enabled);
    event WhitelistUpdated(address indexed user, bool status);
    event VaultUpdated(address indexed newVault);
    event DeadlineUpdated(uint256 newDeadline);
    event MinDepositUpdated(uint256 newMinDeposit);

    constructor(
        address initialOwner,
        address _vault,
        string memory baseURI,
        uint256 _mintDeadline
    ) ERC721("Arc Treasury Early Supporter", "ATES") Ownable(initialOwner) {
        vault = ITreasuryVault(_vault);
        _baseTokenURI = baseURI;
        mintDeadline = _mintDeadline;
    }

    /**
     * @notice Checks if user is eligible to mint
     * @param user Address to check
     * @return eligible Whether user can mint
     * @return reason Reason string
     */
    function canMint(address user) public view returns (bool eligible, string memory reason) {
        if (!mintingEnabled) {
            return (false, "Minting disabled");
        }
        if (_tokenIdCounter >= MAX_SUPPLY) {
            return (false, "Max supply reached");
        }
        if (hasMinted[user]) {
            return (false, "Already minted");
        }
        if (mintDeadline > 0 && block.timestamp > mintDeadline) {
            return (false, "Minting period ended");
        }

        // Check whitelist first
        if (whitelist[user]) {
            return (true, "Whitelisted");
        }

        // Check vault deposit
        if (address(vault) != address(0)) {
            uint256 shares = vault.userShares(user);
            if (shares >= minDepositRequired) {
                return (true, "Has vault deposit");
            }

            // Also check historical deposits
            try vault.userInfo(user) returns (
                uint256 totalDeposited,
                uint256,
                uint256,
                uint256,
                uint256
            ) {
                if (totalDeposited > 0) {
                    return (true, "Historical depositor");
                }
            } catch {}
        }

        return (false, "Not eligible - deposit required or get whitelisted");
    }

    /**
     * @notice Mints one badge to the caller
     * @dev Must be whitelisted OR have deposited in vault
     */
    function mint() external nonReentrant {
        (bool eligible, string memory reason) = canMint(msg.sender);
        require(eligible, reason);

        bool wasWhitelisted = whitelist[msg.sender];

        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;

        hasMinted[msg.sender] = true;
        _safeMint(msg.sender, tokenId);

        emit Mint(msg.sender, tokenId, wasWhitelisted);
    }

    /**
     * @notice Gets the current supply
     * @return Current number of minted badges
     */
    function totalSupply() external view returns (uint256) {
        return _tokenIdCounter;
    }

    /**
     * @notice Gets remaining supply
     * @return Number of badges still available
     */
    function remainingSupply() external view returns (uint256) {
        return MAX_SUPPLY - _tokenIdCounter;
    }

    /**
     * @notice Checks if user owns a badge
     * @param owner Address to check
     * @return true if address owns at least one badge
     */
    function hasBadge(address owner) external view returns (bool) {
        return balanceOf(owner) > 0;
    }

    // ============ Owner Functions ============

    /**
     * @notice Adds addresses to whitelist
     * @param users Array of addresses to whitelist
     */
    function addToWhitelist(address[] calldata users) external onlyOwner {
        for (uint256 i = 0; i < users.length; i++) {
            whitelist[users[i]] = true;
            emit WhitelistUpdated(users[i], true);
        }
    }

    /**
     * @notice Removes addresses from whitelist
     * @param users Array of addresses to remove
     */
    function removeFromWhitelist(address[] calldata users) external onlyOwner {
        for (uint256 i = 0; i < users.length; i++) {
            whitelist[users[i]] = false;
            emit WhitelistUpdated(users[i], false);
        }
    }

    /**
     * @notice Updates the vault address
     * @param _vault New vault address
     */
    function setVault(address _vault) external onlyOwner {
        vault = ITreasuryVault(_vault);
        emit VaultUpdated(_vault);
    }

    /**
     * @notice Sets the mint deadline
     * @param _deadline Unix timestamp (0 = no deadline)
     */
    function setMintDeadline(uint256 _deadline) external onlyOwner {
        mintDeadline = _deadline;
        emit DeadlineUpdated(_deadline);
    }

    /**
     * @notice Sets minimum deposit required
     * @param _minDeposit Minimum shares required (18 decimals)
     */
    function setMinDepositRequired(uint256 _minDeposit) external onlyOwner {
        minDepositRequired = _minDeposit;
        emit MinDepositUpdated(_minDeposit);
    }

    /**
     * @notice Enables or disables minting
     * @param enabled Whether minting should be enabled
     */
    function setMintingEnabled(bool enabled) external onlyOwner {
        mintingEnabled = enabled;
        emit MintingEnabled(enabled);
    }

    /**
     * @notice Sets the base URI for token metadata
     * @param baseURI New base URI
     */
    function setBaseURI(string memory baseURI) external onlyOwner {
        _baseTokenURI = baseURI;
    }

    /**
     * @notice Owner mint for special cases
     * @param to Address to mint to
     */
    function ownerMint(address to) external onlyOwner {
        require(_tokenIdCounter < MAX_SUPPLY, "Max supply reached");
        require(!hasMinted[to], "Already minted");

        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;

        hasMinted[to] = true;
        _safeMint(to, tokenId);

        emit Mint(to, tokenId, true);
    }

    // ============ Metadata ============

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);

        string memory baseURI = _baseURI();
        if (bytes(baseURI).length == 0) {
            return "";
        }

        // If baseURI ends with .json, return it directly (single metadata)
        // Otherwise append tokenId.json
        if (_endsWith(baseURI, ".json")) {
            return baseURI;
        }

        return string(abi.encodePacked(baseURI, _toString(tokenId), ".json"));
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    function _endsWith(string memory str, string memory suffix) internal pure returns (bool) {
        bytes memory strBytes = bytes(str);
        bytes memory suffixBytes = bytes(suffix);

        if (suffixBytes.length > strBytes.length) {
            return false;
        }

        uint256 strStart = strBytes.length - suffixBytes.length;
        for (uint256 i = 0; i < suffixBytes.length; i++) {
            if (strBytes[strStart + i] != suffixBytes[i]) {
                return false;
            }
        }
        return true;
    }
}
