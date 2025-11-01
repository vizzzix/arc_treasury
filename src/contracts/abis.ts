// Simplified ABIs for frontend interaction
// Full ABIs will be imported from artifacts after deployment

export const MOCK_ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function mint(address to, uint256 amount)",
];

export const AI_TREASURY_ABI = [
  "function createTreasury(address[] tokens, uint256[] allocations, uint256 rebalanceThreshold, bool autoYield) returns (address)",
  "function deposit(address treasuryAddr, address token, uint256 amount)",
  "function withdraw(address treasuryAddr, address token, uint256 amount)",
  "function rebalance(address treasuryAddr)",
  "function needsRebalancing(address treasuryAddr) view returns (bool)",
  "function getTreasuryDetails(address treasuryAddr) view returns (address owner, address[] tokens, uint256 totalValue)",
  "function getTokenBalance(address treasuryAddr, address token) view returns (uint256)",
  "function totalValueLocked() view returns (uint256)",
  "function totalTreasuries() view returns (uint256)",
  "function totalYieldGenerated() view returns (uint256)",
  "event TreasuryCreated(address indexed owner, address treasuryAddress)",
  "event Deposited(address indexed treasury, address indexed token, uint256 amount)",
  "event Withdrawn(address indexed treasury, address indexed token, uint256 amount)",
  "event Rebalanced(address indexed treasury, address tokenFrom, address tokenTo, uint256 amountFrom, uint256 amountTo)",
];

export const STRATEGY_MANAGER_ABI = [
  "function getStrategy(string name) view returns (string description, address[] tokens, uint256[] allocations, uint256 rebalanceThreshold, bool autoYield)",
  "function getAllStrategyNames() view returns (string[] names)",
];

export const SWAP_ROUTER_ABI = [
  "function swapExactTokensForTokens(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOutMin, address to) returns (uint256 amountOut)",
  "function getAmountOut(address tokenIn, address tokenOut, uint256 amountIn) view returns (uint256 amountOut)",
];

export const YIELD_AGGREGATOR_ABI = [
  "function deposit(address token, uint256 amount) returns (uint256 shares)",
  "function withdraw(address token, uint256 shares) returns (uint256 amount)",
  "function getCurrentAPY(address token) view returns (uint256 apy)",
  "function getBalance(address token, address user) view returns (uint256 amount)",
];

