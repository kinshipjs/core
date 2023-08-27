-- THIS SCHEMA IS MADE UP OF MOCK DATA, AND IS NOT INTENDED FOR USE ANYWHERE WITHIN KINSHIP OR PERSONAL APPLICATIONS.

DROP DATABASE IF EXISTS kinship_test;
CREATE DATABASE IF NOT EXISTS kinship_test;
USE kinship_test;

CREATE TABLE User (
	Id VARCHAR(9) NOT NULL,
    FirstName VARCHAR(32) NOT NULL,
    LastName VARCHAR(32) NOT NULL,
    PRIMARY KEY (Id),
	INDEX FirstNameIdx (FirstName)
);

CREATE TABLE Role (
	Id VARCHAR(9) NOT NULL,
    Title VARCHAR(32) NOT NULL,
    Description VARCHAR(256),
    PRIMARY KEY (Id),
    INDEX TitleIdx (Title)
);

CREATE TABLE xUserRole (
	UserId VARCHAR(9) NOT NULL,
    RoleId VARCHAR(9) NOT NULL,
    PRIMARY KEY (UserId, RoleId),
    FOREIGN KEY (UserId) REFERENCES User (Id),
    FOREIGN KEY (RoleId) REFERENCES Role (Id)
);

CREATE TABLE LastIdAssigned (
    Id INT AUTO_INCREMENT,
    User INT NOT NULL,
    Role INT NOT NULL,
    PRIMARY KEY (Id)
);

-- names generated using name-generator.org at https://www.name-generator.org.uk/quick/
INSERT INTO User (
    Id, FirstName, LastName
) VALUES 
    ('U-0000000', 'Brenda', 'Gill'),
    ('U-0000001', 'Frederic', 'Reilly'),
    ('U-0000002', 'Leena', 'Wilkins'),
    ('U-0000003', 'Alexander', 'Koch'),
    ('U-0000004', 'Ross', 'Landry'),
    ('U-0000005', 'Mikey', 'Humphrey'),
    ('U-0000006', 'Kamil', 'Harrison'),
    ('U-0000007', 'Fabian', 'Nixon'),
    ('U-0000008', 'Martina', 'York'),
    ('U-0000009', 'Lawson', 'Cox'),
    ('U-0000010', 'Luc', 'Harrison'),
    ('U-0000011', 'Albie', 'Pena'),
    ('U-0000012', 'Simon', 'Rowland'),
    ('U-0000013', 'Rayhan', 'Baker'),
    ('U-0000014', 'Curtis', 'Sosa'),
    ('U-0000015', 'Aurora', 'Bradley'),
    ('U-0000016', 'Olly', 'Fowler'),
    ('U-0000017', 'Damon', 'Li'),
    ('U-0000018', 'Orlando', 'Strong'),
    ('U-0000019', 'Amna', 'Hawkins'),
    ('U-0000020', 'Aneesa', 'Santos');

-- roles are entirely made up.
INSERT INTO Role (
    Id, Title, Description
) VALUES 
    ('R-0000000', 'Administrator', 'Administrator privileges across all applications.'),
    ('R-0000001', 'Kinship-Site-Status-Write', 'Write access to the Kinship Website deployment status page.'),
    ('R-0000002', 'Kinship-Site-Status-Read', 'Read access to the Kinship Website deployment status page.'),
    ('R-0000003', 'Kinship-Collaborator-Write', 'Write access to Kinship repositories.'),
    ('R-0000004', 'Kinship-Collaborator-Read', 'Read access to Kinship repositores.');

INSERT INTO xUserRole (
    UserId, RoleId
) VALUES 
    -- Brenda Gill: admin
    ('U-0000000', 'R-0000000'),

    -- Frederic Reilly: all privileges for Kinship
    ('U-0000001', 'R-0000001'),
    ('U-0000001', 'R-0000002'),
    ('U-0000001', 'R-0000003'),
    ('U-0000001', 'R-0000004'),

    -- Leena Wilkins: only read privileges for Kinship
    ('U-0000002', 'R-0000002'),
    ('U-0000002', 'R-0000004'),
    -- Alexandra Koch: only read privileges for Kinship
    ('U-0000003', 'R-0000002'),
    ('U-0000003', 'R-0000004'),
    -- Ross Landry: only read privileges for Kinship
    ('U-0000004', 'R-0000002'),
    ('U-0000004', 'R-0000004'),
    -- Fabian Nixon: only read privileges for Kinship
    ('U-0000007', 'R-0000002'),
    ('U-0000007', 'R-0000004'),
    -- Lawson Cox: only read privileges for Kinship
    ('U-0000009', 'R-0000002'),
    ('U-0000009', 'R-0000004'),
    -- Luc Harrison: only read privileges for Kinship
    ('U-0000011', 'R-0000002'),
    ('U-0000011', 'R-0000004'),
    -- Aurora Bradley: only read privileges for Kinship
    ('U-0000015', 'R-0000002'),
    ('U-0000015', 'R-0000004'),

    -- Orlando Strong: only read privileges for Kinship Status
    ('U-0000018', 'R-0000002'),
    -- Aneesa Santos: only read privileges for Kinship Collaboration
    ('U-0000020', 'R-0000004'),

    -- Mikey Humphrey: read and write privileges for Kinship Status
    ('U-0000005', 'R-0000001'),
    ('U-0000005', 'R-0000002'),
    -- Kamil Harrison: read and write privileges for Kinship Status
    ('U-0000006', 'R-0000001'),
    ('U-0000006', 'R-0000002'),

    -- Rayhan Baker: read and write privileges for Kinship Collaboration
    ('U-0000013', 'R-0000003'),
    ('U-0000013', 'R-0000004'),
    -- Curtis Sosa: read and write privileges for Kinship Collaboration
    ('U-0000014', 'R-0000003'),
    ('U-0000014', 'R-0000004'),
    -- Amna Hawkins: read and write privileges for Kinship Collaboration
    ('U-0000019', 'R-0000003'),
    ('U-0000019', 'R-0000004');

INSERT INTO LastIdAssigned (
    User, Role
) VALUES 
    (20, 5);