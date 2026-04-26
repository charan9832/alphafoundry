"""
Breakout Strategy
Buys on price breakouts above resistance.
"""
import pandas as pd
import numpy as np

def generate_signals(prices: pd.Series) -> pd.Series:
    """
    Generate trading signals based on price breakouts.
    
    Args:
        prices: Price series
        
    Returns:
        Series of position sizes (-1.0 to 1.0)
    """
    # Calculate rolling high/low
    high_20 = prices.rolling(20).max()
    low_20 = prices.rolling(20).min()
    
    # Breakout signals
    signals = pd.Series(0.0, index=prices.index)
    signals[prices > high_20.shift(1)] = 1.0  # Breakout up
    signals[prices < low_20.shift(1)] = -1.0  # Breakout down
    
    return signals
