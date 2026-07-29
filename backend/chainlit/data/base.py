from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, Dict, List, Optional

from chainlit.types import (
    Feedback,
    PaginatedResponse,
    Pagination,
    ThreadDict,
    ThreadFilter,
)

from .utils import queue_until_user_message

if TYPE_CHECKING:
    from chainlit.element import Element, ElementDict
    from chainlit.step import StepDict
    from chainlit.user import PersistedUser, User


class BaseDataLayer(ABC):
    """Base class for data persistence."""

    @abstractmethod
    async def get_user(self, identifier: str) -> Optional["PersistedUser"]:
        pass

    @abstractmethod
    async def create_user(self, user: "User") -> Optional["PersistedUser"]:
        pass

    @abstractmethod
    async def delete_feedback(
        self,
        feedback_id: str,
    ) -> bool:
        pass

    @abstractmethod
    async def upsert_feedback(
        self,
        feedback: Feedback,
    ) -> str:
        pass

    @queue_until_user_message()
    @abstractmethod
    async def create_element(self, element: "Element"):
        pass

    @abstractmethod
    async def get_element(
        self, thread_id: str, element_id: str
    ) -> Optional["ElementDict"]:
        pass

    @queue_until_user_message()
    @abstractmethod
    async def delete_element(self, element_id: str, thread_id: Optional[str] = None):
        pass

    @queue_until_user_message()
    @abstractmethod
    async def create_step(self, step_dict: "StepDict"):
        pass

    @queue_until_user_message()
    @abstractmethod
    async def update_step(self, step_dict: "StepDict"):
        pass

    @queue_until_user_message()
    @abstractmethod
    async def delete_step(self, step_id: str):
        pass

    @abstractmethod
    async def get_thread_author(self, thread_id: str) -> str:
        return ""

    @abstractmethod
    async def delete_thread(self, thread_id: str):
        pass

    async def delete_user_threads(
        self,
        *,
        user_id: str,
        project_id: Optional[str],
        exclude_thread_id: Optional[str] = None,
    ) -> int:
        """
        Delete all threads owned by ``user_id`` in one project scope.

        ``project_id`` null targets the global bag; a string targets that project.
        When ``exclude_thread_id`` is set, that thread is kept.

        Default implementation paginates ``list_threads`` and deletes one-by-one.
        Supporting data layers should override with a single bulk SQL path.
        """
        thread_ids: List[str] = []
        cursor: Optional[str] = None
        excluded = str(exclude_thread_id or "").strip() or None

        while True:
            res = await self.list_threads(
                Pagination(first=100, cursor=cursor),
                ThreadFilter(userId=user_id, projectId=project_id),
            )
            for thread in res.data:
                thread_id = str(thread.get("id") or "").strip()
                if not thread_id or (excluded and thread_id == excluded):
                    continue
                thread_ids.append(thread_id)

            if not res.pageInfo.hasNextPage or not res.pageInfo.endCursor:
                break
            cursor = res.pageInfo.endCursor

        for thread_id in thread_ids:
            await self.delete_thread(thread_id)
        return len(thread_ids)

    @abstractmethod
    async def list_threads(
        self, pagination: "Pagination", filters: "ThreadFilter"
    ) -> "PaginatedResponse[ThreadDict]":
        pass

    @abstractmethod
    async def get_thread(self, thread_id: str) -> "Optional[ThreadDict]":
        pass

    @abstractmethod
    async def update_thread(
        self,
        thread_id: str,
        name: Optional[str] = None,
        user_id: Optional[str] = None,
        metadata: Optional[Dict] = None,
        tags: Optional[List[str]] = None,
        project_id: Optional[str] = None,
    ):
        pass

    async def upsert_project(self, project_id: str) -> None:
        """Insert or refresh a conversation project. Override in supporting data layers."""
        raise NotImplementedError(
            "Conversation projects are not supported by this data layer."
        )

    async def list_projects(
        self,
        *,
        user_id: str,
        search: Optional[str] = None,
        limit: int = 20,
        exclude_project_id: Optional[str] = None,
    ) -> List[Dict]:
        """
        List projects where ``user_id`` already owns at least one thread.

        Supporting implementations must require ``user_id``.
        """
        raise NotImplementedError(
            "Conversation projects are not supported by this data layer."
        )

    async def set_thread_project_id(
        self,
        thread_id: str,
        project_id: str,
        *,
        user_id: str,
    ) -> str:
        """
        Move a thread owned by ``user_id`` to a project that user already participates in.

        Supporting implementations must require ``user_id``.
        """
        raise NotImplementedError(
            "Conversation projects are not supported by this data layer."
        )

    @abstractmethod
    async def build_debug_url(self) -> str:
        pass

    @abstractmethod
    async def close(self) -> None:
        pass

    @abstractmethod
    async def get_favorite_steps(self, user_id: str) -> List["StepDict"]:
        pass

    async def set_step_favorite(
        self, step_dict: "StepDict", favorite: bool
    ) -> "StepDict":
        metadata = step_dict.get("metadata") or {}
        metadata["favorite"] = favorite
        step_dict["metadata"] = metadata
        await self.update_step(step_dict)
        return step_dict
