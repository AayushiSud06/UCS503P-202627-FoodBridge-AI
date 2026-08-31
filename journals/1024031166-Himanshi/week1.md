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
To design the logistics and administration side of FoodLink.

## Work Done
- Designed the Volunteer dashboard and pickup-task interface.
- Defined the delivery workflow:
  Accept → Pick Up → Deliver → Complete.
- Designed the Admin dashboard with platform statistics.
- Defined the donation status lifecycle:
  ACCEPTED → VOLUNTEER_ASSIGNED → PICKED_UP → DELIVERED → COMPLETED.

## Ideation
We discussed assigning volunteers only based on distance. We identified
that availability, workload, pickup deadline, and capacity may also need to
be considered.

## Problems Faced
Volunteer assignment could become complex if multiple donations and
volunteers are active simultaneously.

## Solution
We planned a multi-factor assignment mechanism that can later be optimized
using algorithms/ML.

## Outcome
The Volunteer and Admin workflows were finalized.

## Next Steps
Implement pickup status changes, map/route representation, and the Admin
dashboard.
