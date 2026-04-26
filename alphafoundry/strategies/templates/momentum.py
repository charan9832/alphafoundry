"""
Momentum Trading Strategy
Buys when momentum is positive, sells when negative.
"""
import pandas as pd
import numpy as np

def generate_signals(prices: pd.Series) -> pd.Series:
    """
    Generate trading signals based on momentum.
    
    Args:
        prices: Price series
        
    Returns:
        Series of position sizes (-1.0 to 1.0)
    """
    # Calculate momentum (20-day rolling mean of returns)
    returns = prices.pct_change()
    momentum = returns.rolling(20).mean()
    
    # Generate signals
    signals = momentum.apply(
        lambda x: 1.0 if x > 0.001 else -1.0 if x < -0.001 else 0.0
    )
    
    return signals
