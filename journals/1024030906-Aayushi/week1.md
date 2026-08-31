# Week 1

## Objective

Set up the UCS503P project repository and establish the initial
documentation and deployment workflow for the FoodLink project.

## Work Completed

- Finalized the FoodLink project idea.
- Forked the UCS503P master repository.
- Configured GitHub Pages.
- Verified the documentation CI/CD workflow.
- Started planning the project architecture and feature scope.

## Technical Decisions

The project will initially focus on a college/community-level food
redistribution workflow involving donors, recipient organizations,
volunteers, and administrators.

## Issues Encountered

Initially, the GitHub Pages deployment branch was not visible.
The documentation workflow was triggered through a repository commit,
after which the GitHub Pages deployment was successfully configured.

## Next Steps

- Finalize project requirements.
- Define system architecture.
- Prepare the project proposal.
- Establish team development workflow.

## Objective
To design the donor and recipient workflows for FoodLink.

## Work Done
- Designed the Donor dashboard and Create Donation interface.
- Defined the information required for a food donation:
  food type, quantity, location, pickup deadline, and storage details.
- Designed the Recipient dashboard for viewing available donations.
- Planned the donation flow:
  Create → Match → Accept.

## Ideation
We discussed displaying all donations to recipients versus intelligently
ranking suitable donations. We decided to introduce multi-factor matching
based on distance, quantity, capacity, and availability.

## Problems Faced
A major challenge was deciding how much information to collect from donors
without making the donation process complicated.

## Solution
We selected only the attributes required for the basic workflow and future
matching system.

## Outcome
The initial Donor and Recipient workflow and UI structure were finalized.

## Next Steps
Implement the interactive donation creation and acceptance workflow.
