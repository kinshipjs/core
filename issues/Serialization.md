Serialization in Kinship is a special feature that allows a user to query their table with confidently knowing the results they receive back will appear as expected.  

For example, if a User were to query all Playlists including a cross reference PlaylistTrack which also includes Track, (in other words, "All playlists and all of their tracks") the User would expect to receive something like:

```json
[
    {
        "PlaylistId": 1,
        "Name": "Music",
        "PlaylistTracks": [
            {
                "PlaylistId": 1,
                "TrackId": 1,
                "Track": {
                    "TrackId": 1,
                    "Name": "Dog Eat Dog",
                    "Composer": "AC/DC",
                    "Bytes": 5000000,
                    "Milliseconds": 5000000
                }
            },
            {
                "PlaylistId": 1,
                "TrackId": 2,
                "Track": {
                    "TrackId": 2,
                    "Name": "Go Down",
                    "Composer": "AC/DC",
                    "Bytes": 5000000,
                    "Milliseconds": 5000000
                }
            },
            ...
        ]
    }
]
```

However, this is an expensive task to do with the current implementation. Serialization in its current implementation takes 400ms to serialize the rows of a `SELECT * FROM Playlist p LEFT JOIN PlaylistTrack pt ON p.PlaylistId = pt.PlaylistId LEFT JOIN Track t ON pt.TrackId = t.TrackId` query. (18 playlists, 8719 playlist tracks, 3503 tracks)

So, the issue is: `How do we optimize this`