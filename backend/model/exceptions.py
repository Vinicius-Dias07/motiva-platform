from typing import Optional


class ModelError(Exception):
    """Base de todas as exceções do módulo model/."""


class MissingConfigError(ModelError):
    """Uma variável de ambiente obrigatória não foi definida."""


class RoboflowCallError(ModelError):
    """A chamada ao workflow do Roboflow falhou."""

    def __init__(
        self,
        message: str,
        *,
        status_code: Optional[int] = None,
        cause: Optional[BaseException] = None,
    ):
        super().__init__(message)
        self.status_code = status_code
        self.cause = cause


class RoboflowTimeoutError(RoboflowCallError):
    """A chamada ao workflow do Roboflow não respondeu dentro do timeout."""


class MaskReconstructionError(ModelError):
    """O JSON de predições retornado pelo Roboflow não tem o formato esperado."""
