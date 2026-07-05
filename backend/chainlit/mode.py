"""Mode and ModeOption dataclasses for the Modes system.

The Modes system allows developers to define multiple picker categories
(e.g., Model, Approach, Reasoning Effort) that users can select from
in the chat composer.
"""

from dataclasses import dataclass, field
from typing import List, Optional

from dataclasses_json import DataClassJsonMixin


@dataclass
class ModeOption(DataClassJsonMixin):
    """A single selectable option within a Mode.

    Attributes:
        id: Unique identifier for this option (e.g., "gpt-5", "planning")
        name: Display name shown in the UI (e.g., "GPT-5", "Planning")
        description: Optional description shown in the dropdown
        tooltip: Optional tooltip text shown on hover
        icon: Optional icon - can be a Lucide icon name, local path, or URL
        selected: Whether this option starts selected in the UI
    """

    id: str
    name: str
    description: Optional[str] = None
    tooltip: Optional[str] = None
    icon: Optional[str] = None
    selected: bool = False


@dataclass
class Mode(DataClassJsonMixin):
    """A category of options the user can select from.

    Each Mode represents a picker dropdown in the chat composer.
    Modes can be configured as single-select or multi-select.

    Attributes:
        id: Unique identifier for this mode (e.g., "llm", "approach")
        name: Display name shown in the UI (e.g., "Model", "Approach")
        description: Optional description for the mode itself
        multi: Whether the mode allows selecting multiple options
        options: List of available options for this mode
    """

    id: str
    name: str
    description: Optional[str] = None
    multi: bool = False
    options: List[ModeOption] = field(default_factory=list)

    def get_selected_options(self) -> List[ModeOption]:
        """Get the selected options, or the first option for single-select modes."""
        selected_options = [option for option in self.options if option.selected]
        if selected_options:
            return selected_options
        if not self.multi and self.options:
            return [self.options[0]]
        return []

    def get_option_by_id(self, option_id: str) -> Optional[ModeOption]:
        """Get an option by its ID."""
        for option in self.options:
            if option.id == option_id:
                return option
        return None
