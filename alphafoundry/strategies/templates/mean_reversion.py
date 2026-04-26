"""
Mean Reversion Strategy
Buys when price is below moving average, sells when above.
"""
import pandas as pd
import numpy as np

def generate_signals(prices: pd.Series) -> pd.Series:
    """
    Generate trading signals based on mean reversion.
    
    Args:
        prices: Price series
        
    Returns:
        Series of position sizes (-1.0 to 1.0)
    """
    # Calculate moving average
    ma = prices.rolling(50).mean()
    
    # Distance from MA
    deviation = (prices - ma) / ma
    
    # Generate signals - mean reversion
    signals = deviation.apply(
        lambda x: 1.0 if x < -0.02 else -1.0 if x > 0.02 else 0.0
    )
    
    return signals
