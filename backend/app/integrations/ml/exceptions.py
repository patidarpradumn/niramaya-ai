"""Custom exceptions for ML Engine integration."""

class MLException(Exception):
    """Base exception for ML Engine integration errors."""
    pass


class MLTimeoutException(MLException):
    """Raised when an ML Engine HTTP request times out."""
    pass


class MLConnectionException(MLException):
    """Raised when connecting to the ML Engine fails."""
    pass


class MLResponseException(MLException):
    """Raised when the ML Engine returns an invalid HTTP status or unparseable response."""
    pass


class MLValidationError(MLException):
    """Raised when the ML Engine response fails schema validation."""
    pass
